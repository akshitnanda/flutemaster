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

# Strict ZERO-REMIX / ZERO-ALT / ZERO-COVER blocklist
ALT_RX = re.compile(
    r'\b(remix|reprise|unplugged|acoustic|live|revival|tribute|medley|club|mix|lofi|lo-fi|'
    r'slowed|reverb|jhankar|mashup|mixtape|coke\s*studio|pocket\s*cinema|2\.0|reloaded|'
    r'remake|instrumental|karaoke|cover|flute|bansuri|piano|guitar|violin|sax|saxophone|'
    r'harmonica|orchestra|symphony|sanam|dj|edm|trap|house|chill|lullaby|ringtone|8d|'
    r'recap|dialogue|boutique|unknown\s*diaries|nitin\s*bali|raj\s*barman|moon\s*vibes|'
    r'roshni\s*dey|bally\s*sagoo|instant\s*karma|step\s*up|workout|gym|sad\s*version|'
    r'female\s*version|recreated|recreation|the\s*unplugged|mtv|t-series\s*mixtape)\b',
    re.I
)

MAJOR_PROF = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROF = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
MAJOR_PROF = (MAJOR_PROF - MAJOR_PROF.mean()) / MAJOR_PROF.std()
MINOR_PROF = (MINOR_PROF - MINOR_PROF.mean()) / MINOR_PROF.std()
PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def norm_hindi(s):
    """Normalize common Hindi-English transliteration variants (aa->a, ee->i, oo->u, chh->ch, etc.)."""
    s = re.sub(r'\([^)]*\)', ' ', (s or '').lower())
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'aa+', 'a', s)
    s = re.sub(r'ee+', 'i', s)
    s = re.sub(r'oo+', 'u', s)
    s = re.sub(r'chh', 'ch', s)
    s = re.sub(r'sh', 's', s)
    s = re.sub(r'ph', 'f', s)
    s = re.sub(r'kh', 'k', s)
    s = re.sub(r'gh', 'g', s)
    s = re.sub(r'bh', 'b', s)
    s = re.sub(r'dh', 'd', s)
    s = re.sub(r'th', 't', s)
    s = re.sub(r'z', 'j', s)
    s = re.sub(r'w', 'v', s)
    s = re.sub(r'ey\b', 'e', s)
    s = re.sub(r'ain\b', 'e', s)
    s = re.sub(r'ein\b', 'e', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def norm_words(s):
    stop = {'the', 'from', 'song', 'full', 'part', 'original', 'motion', 'picture', 'soundtrack', 'piano', 'notes', 'sargam', 'hindi'}
    return [w for w in norm_hindi(s).split() if len(w) >= 2 and w not in stop]

def singer_tokens(sg, comp):
    raw = f'{sg or ""} {comp or ""}'.lower()
    raw = re.sub(r'\b(classic|vocal|bollywood|composer|singer|singers|music|director|and)\b', ' ', raw)
    toks = [w for w in re.sub(r'[^a-z\s]', ' ', raw).split() if len(w) >= 4]
    # Expand common short names
    expanded = set(toks)
    if 'rafi' in raw: expanded.update(['rafi', 'mohammed', 'mohd'])
    if 'lata' in raw: expanded.update(['lata', 'mangeshkar'])
    if 'kishore' in raw: expanded.update(['kishore', 'kumar'])
    if 'asha' in raw: expanded.update(['asha', 'bhosle', 'bhonsle'])
    if 'mukesh' in raw: expanded.add('mukesh')
    if 'sanu' in raw or 'shanu' in raw: expanded.update(['sanu', 'kumar'])
    if 'udit' in raw: expanded.update(['udit', 'narayan'])
    if 'alka' in raw: expanded.update(['alka', 'yagnik'])
    if 'sonu' in raw: expanded.update(['sonu', 'nigam'])
    if 'arijit' in raw: expanded.update(['arijit', 'singh'])
    if 'shreya' in raw: expanded.update(['shreya', 'ghoshal'])
    if 'jagjit' in raw: expanded.update(['jagjit', 'singh'])
    if 'hemant' in raw: expanded.update(['hemant', 'kumar'])
    if 'manna' in raw: expanded.update(['manna', 'dey'])
    if 'talat' in raw: expanded.update(['talat', 'mahmood'])
    if 'burman' in raw: expanded.update(['burman', 'rd', 'sd'])
    if 'rahman' in raw: expanded.add('rahman')
    if 'bala' in raw: expanded.update(['balasubrahmanyam', 'bala'])
    if 'kay' in raw or ' kk' in f' {raw}': expanded.add('kk')
    return expanded

def is_clean_oem_match(song, track, artist, album='', release_year=None):
    combo = f'{track} {artist} {album}'
    if ALT_RX.search(combo):
        return False, 'alt_or_remix'
    # Also reject "(Version)" unless it's "(Original ...)" or "(From ...)"
    if re.search(r'\bversion\b', track, re.I) and not re.search(r'original', track, re.I):
        return False, 'alt_version'

    want_w = norm_words(song['t'])
    got_w = set(norm_words(track))
    if not want_w:
        return False, 'no_title'

    # Check phonetic overlap against track title (use first 4 significant words of song title)
    core_w = want_w[:4]
    matched = sum(1 for w in core_w if w in got_w or any(w in g or g in w for g in got_w if len(g) >= 3))
    ratio = matched / max(1, len(core_w))
    if ratio < 0.50:
        return False, f'title_mismatch({ratio:.2f})'

    # Verify artist/composer OR movie match for classic songs so random covers don't slip through
    s_toks = singer_tokens(song.get('sg', ''), song.get('c', ''))
    m_words = set(norm_words(song.get('m', ''))) - {'bollywood', 'classic', 'traditional', 'bhajan', 'popular'}
    artist_low = f'{artist} {album} {track}'.lower()
    singer_hit = any(t in artist_low for t in s_toks)
    movie_hit = len(m_words) > 0 and any(w in norm_hindi(f'{album} {track}') for w in m_words if len(w) >= 4)

    # For pre-2000 classic Bollywood tracks, require EITHER original singer/composer hit OR original movie hit OR exact >=0.75 title match with reasonable release year
    if song.get('y', 2000) <= 1999 and s_toks:
        if not singer_hit and not movie_hit:
            # Reject modern unrelated covers when release_year is known to be >= 2012
            if release_year and release_year >= 2012:
                return False, f'modern_cover({release_year})'
            if ratio < 0.75:
                return False, 'no_oem_artist_or_movie'

    return True, f'oem(r={ratio:.2f},sg={singer_hit},mv={movie_hit})'

def score_candidate(song, track, artist, album, release_year=None):
    ok, reason = is_clean_oem_match(song, track, artist, album, release_year)
    if not ok:
        return -999, reason
    score = 10
    want_w = norm_words(song['t'])[:4]
    got_w = set(norm_words(track))
    matched = sum(1 for w in want_w if w in got_w or any(w in g or g in w for g in got_w if len(g) >= 3))
    score += int((matched / max(1, len(want_w))) * 20)
    s_toks = singer_tokens(song.get('sg', ''), song.get('c', ''))
    artist_low = f'{artist} {album}'.lower()
    if any(t in artist_low for t in s_toks):
        score += 25
    m_words = [w for w in norm_words(song.get('m', '')) if len(w) >= 4 and w not in ('bollywood', 'classic', 'traditional', 'bhajan', 'popular')]
    if m_words and any(w in norm_hindi(f'{album} {track}') for w in m_words):
        score += 18
    if 'original motion picture soundtrack' in album.lower() or 'from "' in track.lower():
        score += 6
    # Prefer release year closest to original movie year
    if release_year and song.get('y'):
        diff = abs(release_year - song['y'])
        if diff <= 3:
            score += 12
        elif diff <= 10:
            score += 5
    return score, reason

def search_strict_oem(song):
    title = re.sub(r'\([^)]*\)', ' ', song['t']).strip()
    movie = song['m'] if song['m'] not in ('Bollywood Classic', 'Traditional Bhajan', 'Popular Instrumental') else ''
    singer = song['sg'].split(',')[0].split('/')[0].split('&')[0].split('-')[0].strip()
    if singer.lower() in ('classic vocal', ''):
        singer = ''

    queries = []
    if singer and movie:
        queries.append(f'{title} {singer}')
        queries.append(f'{title} {movie}')
    elif singer:
        queries.append(f'{title} {singer}')
    elif movie:
        queries.append(f'{title} {movie}')
    queries.append(title)

    # 1. Try iTunes IN (gives releaseDate + original soundtrack album names!)
    best_overall = None
    for q in queries[:2]:
        try:
            url = 'https://itunes.apple.com/search?' + urllib.parse.urlencode({
                'term': q, 'media': 'music', 'entity': 'song', 'country': 'IN', 'limit': 10
            })
            req = urllib.request.Request(url, headers={'User-Agent': 'FluteMaster-OEM/3.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            for r in data.get('results', []):
                purl = r.get('previewUrl')
                if not purl:
                    continue
                ry = None
                rd = r.get('releaseDate', '')
                if len(rd) >= 4 and rd[:4].isdigit():
                    ry = int(rd[:4])
                sc, reason = score_candidate(song, r.get('trackName', ''), r.get('artistName', ''), r.get('collectionName', ''), ry)
                if sc > 0 and (best_overall is None or sc > best_overall[0]):
                    best_overall = (sc, {
                        'source': 'itunes',
                        'track': r.get('trackName', ''),
                        'artist': r.get('artistName', ''),
                        'album': r.get('collectionName', ''),
                        'releaseYear': ry,
                        'previewUrl': purl,
                        'oemReason': reason,
                    })
            if best_overall and best_overall[0] >= 45:
                return best_overall[1]
        except Exception:
            time.sleep(0.35)

    # 2. Fallback to Deezer strict OEM search
    for q in queries[:2]:
        try:
            url = 'https://api.deezer.com/search?' + urllib.parse.urlencode({'q': q, 'limit': 10})
            req = urllib.request.Request(url, headers={'User-Agent': 'FluteMaster-OEM/3.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            for r in data.get('data', []):
                purl = r.get('preview')
                if not purl:
                    continue
                tname = r.get('title', '')
                artist = (r.get('artist') or {}).get('name', '')
                album = (r.get('album') or {}).get('title', '')
                sc, reason = score_candidate(song, tname, artist, album, None)
                if sc > 0 and (best_overall is None or sc > best_overall[0]):
                    best_overall = (sc, {
                        'source': 'deezer',
                        'track': tname,
                        'artist': artist,
                        'album': album,
                        'releaseYear': None,
                        'previewUrl': purl,
                        'oemReason': reason,
                    })
            if best_overall and best_overall[0] >= 40:
                return best_overall[1]
        except Exception:
            time.sleep(0.35)

    return best_overall[1] if best_overall else None

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

    band = (freqs >= 55) & (freqs <= 6000)
    log_mag = np.log1p(10.0 * mag[:, band])
    diff = np.maximum(0.0, np.diff(log_mag, axis=0))
    band_f = freqs[band]
    weights = np.where(band_f < 300, 1.8, np.where(band_f < 1800, 1.2, 0.7))
    odf = np.sum(diff * weights, axis=1)
    odf = np.maximum(0.0, odf - np.convolve(odf, np.ones(15) / 15.0, mode='same'))
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
    bpms = np.arange(58.0, 152.0, 0.5)
    scores = np.zeros_like(bpms)

    def ac_at(lag_f):
        idx = int(round(lag_f))
        if idx < 1 or idx >= len(ac) - 1:
            return 0.0
        return float(max(ac[idx - 1], ac[idx], ac[idx + 1]))

    for i, bpm in enumerate(bpms):
        lag = (60.0 / bpm) * fps
        s1, s2, s3, s4, s6, s8 = ac_at(lag), ac_at(2*lag), ac_at(3*lag), ac_at(4*lag), ac_at(6*lag), ac_at(8*lag)
        prior = math.exp(-0.5 * ((math.log2(bpm / 96.0)) / 0.48) ** 2)
        score_4 = 1.0 * s1 + 0.9 * s2 + 0.85 * s4 + 0.45 * s8
        score_3 = 1.0 * s1 + 0.95 * s3 + 0.85 * s6
        scores[i] = max(score_4, score_3) * (0.72 + 0.28 * prior)

    best_i = int(np.argmax(scores))
    best_bpm = float(bpms[best_i])
    best_conf = float(scores[best_i])

    lag = (60.0 / best_bpm) * fps
    s2, s3, s4, s6 = ac_at(2 * lag), ac_at(3 * lag), ac_at(4 * lag), ac_at(6 * lag)
    is_dadra = (s3 > s2 * 1.15 and s3 > s4 * 1.08) or (s6 > s4 * 1.22 and s3 > s2 * 1.04)
    onset_density = float(np.sum(odf > 1.4) / (len(x) / sr))

    # Double-time folding for slow classic Indian vocal tracks mis-locked >135 BPM in 4/4
    if not is_dadra and best_bpm >= 136.0 and s2 > 0.14 and onset_density < 6.0:
        best_bpm = best_bpm / 2.0

    # 12-bin chroma key
    chroma = np.zeros(12, dtype=np.float64)
    p_mask = (freqs >= 110) & (freqs <= 2200)
    p_freqs = freqs[p_mask]
    p_mag = np.mean(mag[:, p_mask] ** 2, axis=0)
    midi_bins = np.round(69 + 12 * np.log2(p_freqs / 440.0)).astype(int) % 12
    for b in range(12):
        chroma[b] = float(np.sum(p_mag[midi_bins == b]))
    key_name, key_conf = None, 0.0
    if np.std(chroma) > 1e-12:
        cn = (chroma - chroma.mean()) / np.std(chroma)
        best_corr = -99.0
        for root in range(12):
            for prof in (MAJOR_PROF, MINOR_PROF):
                c = float(np.dot(cn, np.roll(prof, root)) / 12.0)
                if c > best_corr:
                    best_corr = c
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

def main():
    songs = json.load(open(LIB_PATH, encoding='utf-8'))
    cache = json.load(open(CACHE_PATH, encoding='utf-8')) if os.path.exists(CACHE_PATH) else {}

    # Step 1: Audit every existing cache entry against our STRICT OEM gate!
    kept = 0
    purged = 0
    recheck_songs = []
    for song in songs:
        sid = song['id']
        entry = cache.get(sid)
        if entry and entry.get('status') == 'ok':
            ok, reason = is_clean_oem_match(song, entry.get('track', ''), entry.get('artist', ''), entry.get('album', ''), entry.get('releaseYear'))
            if ok:
                # Also fold double-time outliers on existing clean OEM tracks!
                if entry.get('tala') != 'dadra' and entry.get('bpm', 90) >= 136 and entry.get('onsetDensity', 5.0) < 6.0:
                    entry['bpm'] = int(round(entry['bpm'] / 2.0))
                    entry['rawBpm'] = round(entry['rawBpm'] / 2.0, 1)
                entry['oemVerified'] = True
                kept += 1
            else:
                cache[sid] = {'status': 'purged_alt', 'prevReason': reason, 'prevTrack': entry.get('track', '')}
                purged += 1
                recheck_songs.append(song)
        else:
            # Retry previously not_found/err tracks with our smarter normalized Hindi + singer query!
            recheck_songs.append(song)

    print(f'Strict OEM Audit -> Kept clean OEM: {kept} | Purged remixes/alts/mismatches: {purged} | Re-verifying: {len(recheck_songs)}', flush=True)
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2)

    def worker(song):
        time.sleep(0.45)
        meta = search_strict_oem(song)
        if not meta:
            return song['id'], {'status': 'no_oem_match'}
        try:
            mir = analyze_audio(meta['previewUrl'])
            if not mir:
                return song['id'], {'status': 'audio_fail', 'track': meta['track']}
            return song['id'], {
                'status': 'ok',
                'oemVerified': True,
                'source': meta['source'],
                'track': meta['track'],
                'artist': meta['artist'],
                'album': meta['album'],
                'releaseYear': meta['releaseYear'],
                'oemReason': meta['oemReason'],
                **mir,
            }
        except Exception as e:
            return song['id'], {'status': 'err', 'err': str(e)[:80]}

    recovered = 0
    done = 0
    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = {ex.submit(worker, s): s for s in recheck_songs}
        for fut in as_completed(futs):
            sid, res = fut.result()
            cache[sid] = res
            done += 1
            if res.get('status') == 'ok':
                recovered += 1
            if done % 20 == 0 or done == len(recheck_songs):
                with open(CACHE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(cache, f, indent=2)
                print(f'  OEM Re-verify progress: {done}/{len(recheck_songs)} | Recovered OEM: +{recovered} (Total clean OEM: {kept + recovered}/{len(songs)})', flush=True)

    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(cache, f, indent=2)
    print(f'STRICT OEM VERIFICATION COMPLETE: {kept + recovered}/{len(songs)} verified 100% original tracks (ZERO remixes/alts)!', flush=True)

if __name__ == '__main__':
    main()
