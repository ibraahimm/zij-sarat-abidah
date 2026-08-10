# -*- coding: utf-8 -*-
"""الجالب المركزي لطقس سراة عبيدة — **نسخة واحدة يقرؤها كل الزوّار.**

╔══════════════════════════════════════════════════════════════════════╗
║  القاعدة المعمارية: **لا متصفّح زائرٍ يتصل بـOpen-Meteo أبداً.**       ║
║  يُنادى المصدر مركزياً مرةً كل دورة، ويُكتب `weather-live.json`،       ║
║  ويقرؤه الزوّار كلّهم من موقعنا. فعدد الزوّار لا يزيد عدد الطلبات.    ║
╚══════════════════════════════════════════════════════════════════════╝

ولهذا الملف مسؤولية واحدة: **يبني الرابط، وينادي مرة، ويتحقق بصرامة، ويكتب
ملفاً صالحاً للنشر.** ولا يعرف شيئاً عن العرض ولا عن HTML.

  python3 fetch_weather.py out/site/weather-live.json

**وعند فشل أي شرط لا يُكتب شيء ولا يُمسّ الملف القائم** — فآخر نسخة ناجحة
أنفعُ للقارئ من ملفٍ ناقص. والخروج يكون بقيمة غير صفرية ليوقف دورة النشر.
"""
import datetime as dt
import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request

ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

# سراة عبيدة — من `rain.LOCATIONS` مصدراً واحداً، فلا يتفرّع الإحداثي
try:
    from rain import LOCATIONS
    LAT, LON, ELEV = LOCATIONS['sarat'][0], LOCATIONS['sarat'][1], LOCATIONS['sarat'][2]
except Exception:                                     # يعمل وحده في الـworkflow
    LAT, LON, ELEV = 18.0993, 43.1166, 2360

CURRENT = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
           'dew_point_2m', 'weather_code', 'is_day', 'cloud_cover',
           'pressure_msl', 'visibility', 'wind_speed_10m', 'wind_direction_10m',
           'wind_gusts_10m', 'precipitation', 'precipitation_probability']

HOURLY = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
          'dew_point_2m', 'weather_code', 'wind_speed_10m', 'wind_direction_10m',
          'visibility', 'precipitation_probability', 'rain', 'showers',
          'snowfall', 'is_day']

DAILY = ['weather_code', 'temperature_2m_max', 'temperature_2m_min',
         'apparent_temperature_max', 'apparent_temperature_min',
         'relative_humidity_2m_mean', 'precipitation_probability_max',
         'precipitation_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max',
         'wind_direction_10m_dominant', 'sunrise', 'sunset',
         'sunshine_duration', 'uv_index_max']

N_HOURS = 48        # قسم الفترات لا يحتاج أكثر
N_DAYS = 15         # اليوم + أربعة عشر قادمة

PARAMS = {
    'timezone': 'Asia/Riyadh',
    'temperature_unit': 'celsius',
    'wind_speed_unit': 'kmh',
    'precipitation_unit': 'mm',
    'timeformat': 'iso8601',
    'forecast_days': str(N_DAYS),
    'forecast_hours': str(N_HOURS),
}

# الوحدات التي يبني عليها العارض حسابه — تُقابَل بما يعلنه الردّ نفسه.
# فتغييرٌ صامت في الواجهة (سنتيمترات بدل مليمترات مثلاً) يوقف الدورة
# ولا يمرّ إلى القارئ رقماً بوحدةٍ غير وحدته.
EXPECT_UNITS = {
    'hourly': {'temperature_2m': '°C', 'apparent_temperature': '°C',
               'dew_point_2m': '°C', 'wind_speed_10m': 'km/h',
               'visibility': 'm', 'rain': 'mm', 'showers': 'mm',
               'snowfall': 'cm', 'relative_humidity_2m': '%',
               'precipitation_probability': '%'},
    'daily': {'temperature_2m_max': '°C', 'temperature_2m_min': '°C',
              'apparent_temperature_max': '°C', 'apparent_temperature_min': '°C',
              'wind_speed_10m_max': 'km/h', 'wind_gusts_10m_max': 'km/h',
              'precipitation_sum': 'mm', 'sunshine_duration': 's',
              'relative_humidity_2m_mean': '%', 'precipitation_probability_max': '%'},
    'current': {'temperature_2m': '°C', 'apparent_temperature': '°C',
                'dew_point_2m': '°C', 'wind_speed_10m': 'km/h',
                'wind_gusts_10m': 'km/h', 'visibility': 'm',
                'pressure_msl': 'hPa', 'precipitation': 'mm',
                'cloud_cover': '%', 'relative_humidity_2m': '%'},
}

SOURCE = 'Open-Meteo (open-meteo.com) — CC BY 4.0'


def build_url(lat=LAT, lon=LON, elev=ELEV):
    p = dict(PARAMS)
    p.update(latitude=str(lat), longitude=str(lon), elevation=str(int(elev)),
             current=','.join(CURRENT), hourly=','.join(HOURLY),
             daily=','.join(DAILY))
    return ENDPOINT + '?' + urllib.parse.urlencode(p)


def fetch(url=None, timeout=30):
    with urllib.request.urlopen(url or build_url(), timeout=timeout) as r:
        if r.status != 200:
            raise RuntimeError(f'HTTP {r.status}')
        return json.load(r)


def validate(d):
    """يعيد قائمة المشكلات. وفراغُها شرطُ الكتابة."""
    bad = []
    if not isinstance(d, dict):
        return ['الردّ ليس كائن JSON']

    cur = d.get('current')
    if not isinstance(cur, dict):
        bad.append('لا قسم current في الردّ')
    else:
        miss = [k for k in CURRENT if k not in cur]
        if miss:
            bad.append(f'current ينقصه: {", ".join(miss)}')
        if 'time' not in cur:
            bad.append('current بلا time')

    for sec, keys, n in (('hourly', HOURLY, N_HOURS), ('daily', DAILY, N_DAYS)):
        s = d.get(sec)
        if not isinstance(s, dict):
            bad.append(f'لا قسم {sec} في الردّ')
            continue
        t = s.get('time')
        if not isinstance(t, list):
            bad.append(f'{sec}.time ليس قائمة')
            continue
        if len(t) != n:
            bad.append(f'{sec}.time طوله {len(t)} والمتوقَّع {n}')
        for k in keys:
            v = s.get(k)
            if not isinstance(v, list):
                bad.append(f'{sec}.{k} مفقود أو ليس قائمة')
            elif len(v) != len(t):
                bad.append(f'{sec}.{k} طوله {len(v)} و{sec}.time {len(t)}')

    day = (d.get('daily') or {}).get('time')
    if isinstance(day, list):
        if not day:
            bad.append('daily فارغ — لا daily[0]')
        elif len(day) < N_DAYS:
            bad.append(f'لا daily[{N_DAYS - 1}]')

    for sec, want in EXPECT_UNITS.items():
        u = d.get(sec + '_units')
        if not isinstance(u, dict):
            bad.append(f'لا {sec}_units في الردّ')
            continue
        for k, exp in want.items():
            got = u.get(k)
            if got != exp:
                bad.append(f'{sec}_units.{k} = {got!r} والعارض يفترض {exp!r}')
    return bad


def payload(d, generated_at=None):
    """ما يُنشَر: أقسام الردّ التي يحتاجها العارض، ومعها وسمُنا."""
    now = generated_at or dt.datetime.now(dt.timezone.utc)
    return {
        'generated_at': now.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'source': SOURCE,
        'endpoint': ENDPOINT,
        'location': {'name': 'سراة عبيدة', 'lat': LAT, 'lon': LON,
                     'elevation_m': ELEV, 'timezone': PARAMS['timezone']},
        'refresh_minutes': 15,
        'current': d['current'], 'current_units': d['current_units'],
        'hourly': d['hourly'], 'hourly_units': d['hourly_units'],
        'daily': d['daily'], 'daily_units': d['daily_units'],
    }


def write(path, data=None, generated_at=None):
    """يكتب الملف **ذرّياً** بعد التحقق. ويرفع عند الفشل بلا مساس بالقائم."""
    d = data if data is not None else fetch()
    bad = validate(d)
    if bad:
        raise ValueError('فشل التحقق:\n  - ' + '\n  - '.join(bad))
    out = payload(d, generated_at)
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    json.loads(body)                       # التسلسل صالح، لا نكتب ما لا يُقرأ
    os.makedirs(os.path.dirname(os.path.abspath(path)) or '.', exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)) or '.',
                               suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(body)
        # `mkstemp` يعطي 0600، والملفّ يُخدَم على الوِب — فيُفتح للقراءة
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)              # استبدالٌ ذرّي — لا ملفّ نصفَ مكتوب
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return out


if __name__ == '__main__':
    dest = sys.argv[1] if len(sys.argv) > 1 else 'weather-live.json'
    try:
        o = write(dest)
    except Exception as e:
        print(f'✗ لم يُكتب {dest} — {e}', file=sys.stderr)
        print('  والنسخة القائمة (إن وُجدت) لم تُمسّ.', file=sys.stderr)
        sys.exit(1)
    print(f"✓ {dest} — {o['generated_at']} · "
          f"hourly {len(o['hourly']['time'])} · daily {len(o['daily']['time'])}")
