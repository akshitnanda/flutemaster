import urllib.request
import urllib.parse
import json
import subprocess
import numpy as np
import math
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

LIB_PATH = os.path.abspath('public/data/library.json')
CACHE_PATH = os.path.abspath('data/mir-bpm-cache.json')

BAD_TOKENS = (
    'karaoke', 'instrumental', 'lofi', 'lo-fi', 'slowed', 'reverb', 'remix',
    'ringtone', '8d', 'cover', 'piano', 'flute', 'guitar version', 'unplugged',
    'dj ', 'mashup', 'lullaby', 'music box', 'orchestra'
)

# Krumhansl-Schmuckler major & minor chroma templates (C, C#, D, ..., B)
MAJOR_PROF = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROF = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
MAJOR_PROF = (MAJOR_PROF - MAJOR_PROF.mean()) / MAJOR_PROF.std()
MINOR_PROF = (MINOR_PROF - MINOR_PROF.mean()) / MINOR_PROF.std()
PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def clean_query(text):
    text = re.sub(r'\([^)]*\)', ' ', text or '')
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def pick_best_result(results, title_words, url_key, name_key, album_key, artist_key):
    scored = []
    for r in results:
        purl = r.get(url_key)
        if not purl:
            continue
        tname = str(r.get(name_key, ''))
        album = str(r.get(album_key, '') if not isinstance(r.get(album_key), dict) else r[album_key].get('title', ''))
        artist = str(r.get(artist_key, '') if not isinstance(r.get(artist_key), dict) else r[artist_key].get('name', ''))
        combo = (tname + ' ' + album + ' ' + artist).lower()
        score = 0
        if any(b in combo for b in BAD_TOKENS):
            score -= 20
        t_low = tname.lower()
        matched_words = sum(1 for w in title_words if len(w) >= 3 and w in t_low)
        score += matched_words * 5
        if 'from "' in t_low or 'original motion picture' in album.lower():
            score += 4
        scored.append((score, r, tname, artist, album, purl))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    best = scored[0]
    if best[0] < -10:
        return None
    return best

def fetch_preview_itunes(title, movie, singer):
    t_clean = clean_query(title)
    m_clean = clean_query(movie)
    if m_clean.lower() in ('bollywood classic', 'traditional bhajan', 'popular instrumental'):
        m_clean = ''
    s_clean = clean_query((singer or '').split(',')[0].split('&')[0])
    if s_clean.lower() == 'classic vocal':
        s_clean = ''

    title_words = [w.lower() for w in t_clean.split() if len(w) >= 3]
    queries = []
    if m_clean:
        queries.append(f'{t_clean} {m_clean}')
    if s_clean:
        queries.append(f'{t_clean} {s_clean}')
    queries.append(t_clean)

    for q in queries[:2]:
        try:
            url = 'https://itunes.apple.com/search?' + urllib.parse.urlencode({
                'term': q, 'media': 'music', 'entity': 'song', 'country': 'IN', 'limit': 6
            })
            req = urllib.request.Request(url, headers={'User-Agent': 'FluteMaster-MIR/2.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            hit = pick_best_result(
                data.get('results', []), title_words,
                'previewUrl', 'trackName', 'collectionName', 'artistName'
            )
            if hit:
                _, _, tname, artist, album, purl = hit
                return {'source': 'itunes', 'track': tname, 'artist': artist, 'album': album, 'previewUrl': purl, 'apiBpm': 0}
        except Exception:
            time.sleep(0.15)
    return None

def fetch_preview_deezer(title, movie):
    t_clean = clean_query(title)
    m_clean = clean_query(movie)
    if m_clean.lower() in ('bollywood classic', 'traditional bhajan', 'popular instrumental'):
        m_clean = ''
    title_words = [w.lower() for w in t_clean.split() if len(w) >= 3]
    queries = [f'{t_clean} {m_clean}'.strip(), t_clean] if m_clean else [t_clean]
    for q in queries:
        try:
            url = 'https://api.deezer.com/search?' + urllib.parse.urlencode({'q': q, 'limit': 6})
            req = urllib.request.Request(url, headers={'User-Agent': 'FluteMaster-MIR/2.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            hit = pick_best_result(
                data.get('data', []), title_words,
                'preview', 'title', 'album', 'artist'
            )
            if hit:
                _, r, tname, artist, album, purl = hit
                return {'source': 'deezer', 'track': tname, 'artist': artist, 'album': album, 'previewUrl': purl, 'apiBpm': 0}
        except Exception:
            time.sleep(0.4)
    return None

def analyze_audio(preview_url):
    sr = 22050
    hop = 256
    win_len = 1024
    raw = subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', preview_url,
        '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'
    ], timeout=15)
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if len(x) < sr * 8:
        return None

    n_frames = (len(x) - win_len) // hop
    if n_frames < 200:
        return None
    win = np.hanning(win_len)
    frames = np.lib.stride_tricks.as_strided(
        x, shape=(n_frames, win_len), strides=(x.strides[0] * hop, x.strides[0])
    )
    mag = np.abs(np.fft.rfft(frames * win, axis=1))
    freqs = np.fft.rfftfreq(win_len, 1.0 / sr)

    # 1. Tempo & Meter via Multi-band Log-Compressed Spectral Flux Autocorrelation
    band = (freqs >= 55) & (freqs <= 6000)
    log_mag = np.log1p(10.0 * mag[:, band])
    diff = np.maximum(0.0, np.diff(log_mag, axis=0))
    band_f = freqs[band]
    weights = np.where(band_f < 300, 1.8, np.where(band_f < 1800, 1.2, 0.7))
    odf = np.sum(diff * weights, axis=1)
    k = 15
    odf = np.maximum(0.0, odf - np.convolve(odf, np.ones(k) / k, mode='same'))
    odf = odf - np.mean(odf)
    std = np.std(odf)
    if std < 1e-6:
        return None
    odf /= std

    n = len(odf)
    nfft = 1 << int(np.ceil(np.log2(2 * n)))
    F = np.fft.rfft(odf, nfft)
    ac = np.fft.irfft(F * np.conj(F), nfft)[:n]
    ac = ac / (ac[0] + 1e-12)

    fps = sr / hop
    bpms = np.arange(58.0, 156.0, 0.5)
    scores = np.zeros_like(bpms)

    def ac_at(lag_f):
        idx = int(round(lag_f))
        if idx < 1 or idx >= len(ac) - 1:
            return 0.0
        return float(max(ac[idx - 1], ac[idx], ac[idx + 1]))

    for i, bpm in enumerate(bpms):
        lag = (60.0 / bpm) * fps
        s1 = ac_at(lag)
        s2 = ac_at(2 * lag)
        s3 = ac_at(3 * lag)
        s4 = ac_at(4 * lag)
        s6 = ac_at(6 * lag)
        s8 = ac_at(8 * lag)
        prior = math.exp(-0.5 * ((math.log2(bpm / 98.0)) / 0.52) ** 2)
        score_4 = 1.0 * s1 + 0.9 * s2 + 0.85 * s4 + 0.45 * s8
        score_3 = 1.0 * s1 + 0.95 * s3 + 0.85 * s6
        scores[i] = max(score_4, score_3) * (0.75 + 0.25 * prior)

    best_i = int(np.argmax(scores))
    best_bpm = float(bpms[best_i])
    best_conf = float(scores[best_i])

    lag = (60.0 / best_bpm) * fps
    s2, s3, s4, s6 = ac_at(2 * lag), ac_at(3 * lag), ac_at(4 * lag), ac_at(6 * lag)
    is_dadra = (s3 > s2 * 1.15 and s3 > s4 * 1.08) or (s6 > s4 * 1.22 and s3 > s2 * 1.04)

    onset_density = float(np.sum(odf > 1.4) / (len(x) / sr))

    # 2. 12-Bin Chroma Key Estimation (for songs without an explicit flute scale)
    chroma = np.zeros(12, dtype=np.float64)
    p_mask = (freqs >= 110) & (freqs <= 2200)
    p_freqs = freqs[p_mask]
    p_mag = np.mean(mag[:, p_mask] ** 2, axis=0)
    midi_bins = np.round(69 + 12 * np.log2(p_freqs / 440.0)).astype(int) % 12
    for b in range(12):
        chroma[b] = float(np.sum(p_mag[midi_bins == b]))
    c_std = np.std(chroma)
    key_name = None
    key_conf = 0.0
    if c_std > 1e-12:
        cn = (chroma - chroma.mean()) / c_std
        best_corr = -99.0
        for root in range(12):
            maj_c = float(np.dot(cn, np.roll(MAJOR_PROF, root)) / 12.0)
            min_c = float(np.dot(cn, np.roll(MINOR_PROF, root)) / 12.0)
            if maj_c > best_corr:
                best_corr = maj_c
                key_name = PITCH_NAMES[root]
            if min_c > best_corr:
                best_corr = min_c
                key_name = PITCH_NAMES[root]
        key_conf = round(best_corr, 3)

    return {
        'bpm': int(round(best_bpm)),
        'rawBpm': round(best_bpm, 1),
        'tala': 'dadra' if is_dadra else 'keherwa',
        'conf': round(best_conf, 3),
        'onsetDensity': round(onset_density, 2),
        'key': key_name,
        'keyConf': key_conf,
    }

def process_song(song):
    sid = song['id']
    title = song['t']
    movie = song['m']
    singer = song['sg']

    # Polite pacing avoids iTunes / Deezer 429 rate limits on pass 2
    time.sleep(0.45)
    meta = fetch_preview_deezer(title, movie)
    if not meta:
        meta = fetch_preview_itunes(title, movie, singer)
    if not meta:
        return sid, {'status': 'not_found'}

    for attempt in range(2):
        try:
            mir = analyze_audio(meta['previewUrl'])
            if not mir:
                return sid, {'status': 'audio_fail', 'track': meta['track']}
            return sid, {
                'status': 'ok',
                'source': meta['source'],
                'track': meta['track'],
                'artist': meta['artist'],
                **mir,
            }
        except Exception as e:
            if attempt == 0:
                time.sleep(1.5)
                # Fall back to the other provider if CDN throttled
                alt = fetch_preview_itunes(title, movie, singer) if meta['source'] == 'deezer' else fetch_preview_deezer(title, movie)
                if alt:
                    meta = alt
            else:
                return sid, {'status': 'err', 'err': str(e)[:80]}
    return sid, {'status': 'err', 'err': 'retry_exhausted'}

def main():
    songs = json.load(open(LIB_PATH, encoding='utf-8'))
    cache = {}
    if os.path.exists(CACHE_PATH):
        try:
            cache = json.load(open(CACHE_PATH, encoding='utf-8'))
        except Exception:
            cache = {}

    todo = [s for s in songs if s['id'] not in cache or cache[s['id']].get('status') != 'ok']
    print(f'Total archive songs: {len(songs)} | Already verified: {len(songs) - len(todo)} | Pass 2 to analyze: {len(todo)}', flush=True)

    done = 0
    ok_cnt = sum(1 for v in cache.values() if v.get('status') == 'ok')
    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = {ex.submit(process_song, s): s for s in todo}
        for fut in as_completed(futs):
            sid, res = fut.result()
            cache[sid] = res
            done += 1
            if res.get('status') == 'ok':
                ok_cnt += 1
            if done % 20 == 0 or done == len(todo):
                with open(CACHE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(cache, f, indent=2)
                print(f'  Pass 2 progress: {done}/{len(todo)} | Total audio-verified: {ok_cnt}/{len(songs)}', flush=True)

    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2)

    dadra_cnt = sum(1 for v in cache.values() if v.get('status') == 'ok' and v.get('tala') == 'dadra')
    high_conf = sum(1 for v in cache.values() if v.get('status') == 'ok' and v.get('conf', 0) >= 0.45)
    print(f'COMPLETE! Verified audio MIR for {ok_cnt}/{len(songs)} songs | High-conf: {high_conf} | Dadra detected: {dadra_cnt}', flush=True)

if __name__ == '__main__':
    main()
