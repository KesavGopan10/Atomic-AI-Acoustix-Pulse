"""
model_utils.py
--------------
Preprocessing pipeline for respiratory audio classification.
Faithfully mirrors the classes used in the training notebook
(respiratory_disease_rf_cv_91_f1_score.py) so that inference
produces exactly the same feature DataFrame the model was trained on.

DO NOT retrain the model here. Inference-only.
"""

import io
import os

import librosa
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline

# ---------------------------------------------------------------------------
# Ensure pydub can find ffmpeg (Internal fallback for Windows/Linux)
# ---------------------------------------------------------------------------
try:
    from pydub import AudioSegment
    if os.name == "nt":  # Windows specific path handling
        _WINGET_FFMPEG = (
            r"C:\Users\Kesav\AppData\Local\Microsoft\WinGet\Packages"
            r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
            r"\ffmpeg-8.0.1-full_build\bin"
        )
        if os.path.isdir(_WINGET_FFMPEG):
            os.environ["PATH"] = _WINGET_FFMPEG + os.pathsep + os.environ.get("PATH", "")
            AudioSegment.converter = os.path.join(_WINGET_FFMPEG, "ffmpeg.exe")
            AudioSegment.ffprobe = os.path.join(_WINGET_FFMPEG, "ffprobe.exe")
except ImportError:
    pass



# ---------------------------------------------------------------------------
# 1.  AudioLoader
#     Input : list[str]   — absolute file paths
#     Output: dict        — {filename: {'data': np.ndarray, 'sample_rate': int}}
# ---------------------------------------------------------------------------

class AudioLoader(BaseEstimator, TransformerMixin):
    """Load raw audio waveforms from a list of file paths.

    For non-WAV/FLAC/OGG files (e.g. m4a from Android), we use pydub to
    convert to WAV in-memory before handing to librosa. This avoids the
    deprecated audioread fallback and works on any format ffmpeg supports.
    """

    # Extensions librosa/soundfile can read natively (no ffmpeg needed)
    _NATIVE_EXTS = {".wav", ".flac", ".ogg", ".opus"}

    def fit(self, X, y=None):
        self.fitted_ = True
        return self

    def transform(self, X):
        result = {}
        for file_path in X:
            filename = file_path.split("\\")[-1] if "\\" in file_path else file_path.split("/")[-1]
            ext = os.path.splitext(file_path)[1].lower()

            if ext not in self._NATIVE_EXTS:
                # Convert to WAV in-memory so librosa can decode without audioread
                try:
                    from pydub import AudioSegment
                    fmt = ext.lstrip(".") or "m4a"
                    segment = AudioSegment.from_file(file_path, format=fmt)
                    buf = io.BytesIO()
                    segment.export(buf, format="wav")
                    buf.seek(0)
                    y_audio, sr = librosa.load(buf, sr=None, mono=True)
                except Exception as conv_err:
                    # Last resort: let librosa try on its own
                    import warnings
                    warnings.warn(f"pydub conversion failed ({conv_err}), falling back to librosa direct load")
                    y_audio, sr = librosa.load(file_path, mono=True)
            else:
                y_audio, sr = librosa.load(file_path, mono=True)

            result[filename] = {"data": y_audio, "sample_rate": sr}
        return result


# ---------------------------------------------------------------------------
# 2.  AudioTrimmer
#     Trims (or zero-pads) every clip to a fixed duration so all feature
#     matrices have identical shapes.  The default duration matches the
#     shortest clip in the training dataset.
# ---------------------------------------------------------------------------

class AudioTrimmer(BaseEstimator, TransformerMixin):
    """Trim (or zero-pad) audio to a fixed duration."""

    TARGET_DURATION = 7.8560090702947845

    def __init__(self, target_duration: float = TARGET_DURATION):
        self.target_duration = target_duration

    def fit(self, X, y=None):
        self.fitted_ = True
        return self

    def transform(self, X):
        trimmed = {}
        for filename, audio_info in X.items():
            target_samples = int(self.target_duration * audio_info["sample_rate"])

            if len(audio_info["data"]) < target_samples:
                trimmed_data = np.pad(
                    audio_info["data"],
                    (0, target_samples - len(audio_info["data"])),
                    "constant",
                )
            else:
                trimmed_data = audio_info["data"][:target_samples]

            trimmed[filename] = {
                "data": trimmed_data,
                "sample_rate": audio_info["sample_rate"],
                "duration": self.target_duration,
            }
        return trimmed


# ---------------------------------------------------------------------------
# 3.  FeatureExtractor
#     Extracts the same 8 librosa features used during training.
# ---------------------------------------------------------------------------

class FeatureExtractor(BaseEstimator, TransformerMixin):
    """Extract the 8 acoustic features used during training."""

    def fit(self, X, y=None):
        self.fitted_ = True
        return self

    def transform(self, X):
        features = {}
        for filename, audio_info in X.items():
            y_audio = audio_info["data"]
            sr = audio_info["sample_rate"]

            features[filename] = {
                "chroma_stft":        librosa.feature.chroma_stft(y=y_audio, sr=sr),
                "mfcc":               librosa.feature.mfcc(y=y_audio, sr=sr, n_mfcc=13),
                "mel_spectrogram":    librosa.feature.melspectrogram(y=y_audio, sr=sr),
                "spectral_contrast":  librosa.feature.spectral_contrast(y=y_audio, sr=sr),
                "spectral_centroid":  librosa.feature.spectral_centroid(y=y_audio, sr=sr),
                "spectral_bandwidth": librosa.feature.spectral_bandwidth(y=y_audio, sr=sr),
                "spectral_rolloff":   librosa.feature.spectral_rolloff(y=y_audio, sr=sr),
                "zero_crossing_rate": librosa.feature.zero_crossing_rate(y=y_audio),
            }
        return features


# ---------------------------------------------------------------------------
# 4.  FeatureStatisticsCalculator
#     Collapses per-frame arrays → mean / std / max / min.
#     Drops excluded features and non-numeric columns.
# ---------------------------------------------------------------------------

_DEFAULT_EXCLUDED = ("mel_spectrogram_min", "chroma_stft_max")


class FeatureStatisticsCalculator(BaseEstimator, TransformerMixin):
    """Compute mean/std/max/min statistics and return a numeric DataFrame."""

    def __init__(self, excluded_features=None):
        self.excluded_features = excluded_features or list(_DEFAULT_EXCLUDED)

    def fit(self, X, y=None):
        self.fitted_ = True
        return self

    def transform(self, X):
        rows = []
        for filename, features in X.items():
            row = {"filename": filename}
            for feat_name, feat_data in features.items():
                row[f"{feat_name}_mean"] = np.mean(feat_data)
                row[f"{feat_name}_std"]  = np.std(feat_data)
                row[f"{feat_name}_max"]  = np.max(feat_data)
                row[f"{feat_name}_min"]  = np.min(feat_data)
            rows.append(row)

        df = pd.DataFrame(rows)

        # Drop excluded columns
        df = df.drop(
            columns=[c for c in self.excluded_features if c in df.columns],
        )

        # Return only numeric columns (drops 'filename')
        return df.select_dtypes(exclude=["object"])


# ---------------------------------------------------------------------------
# 5.  Pipeline factory
# ---------------------------------------------------------------------------

def create_respiratory_pipeline() -> Pipeline:
    """
    Return a fresh sklearn Pipeline:
      1. AudioLoader              — loads WAV → dict
      2. AudioTrimmer             — trims/pads to 7.856 s
      3. FeatureExtractor         — 8 librosa features per file
      4. FeatureStatisticsCalculator — mean/std/max/min → DataFrame
    """
    return Pipeline(
        steps=[
            ("load_audio",           AudioLoader()),
            ("trim_audio",           AudioTrimmer()),
            ("extract_features",     FeatureExtractor()),
            ("calculate_statistics", FeatureStatisticsCalculator()),
        ]
    )
