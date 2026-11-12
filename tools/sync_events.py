#!/usr/bin/env python3
"""Генерирует events.json из EVENTS в index.html календаря.
events.json читает главная rki.center (rki.center/…): статусы «Планируется / Уже прошло» считаются по датам.
Запуск после любого изменения событий:  python3 tools/sync_events.py"""
import re, json, sys
h = open('index.html', encoding='utf8').read()
EV = json.loads(re.search(r'const EVENTS=(\{.*?\});', h, re.S).group(1))
SL = dict(re.findall(r"([\w-]+)\s*:\s*'([\w-]+)'", re.search(r'SLUG\s*=\s*\{(.*?)\}', h, re.S).group(1)))
SHOWN = set(re.findall(r'<article class="ev [^"]*"[^>]*data-id="([\w-]+)"', h))  # только события, которые есть на странице календаря
YEAR = int(re.search(r'YEAR\s*:\s*(\d{4})', h).group(1)) if re.search(r'YEAR\s*:\s*(\d{4})', h) else 2026
EXTRA = {  # короткие названия, спикеры и ссылки на записи — правятся здесь
 'multiki': dict(short='Мир мультфильмов: что стоит посмотреть каждому', speaker='Прокопий Уляшов, художник', rec='https://rki.center/mult/'),
 'chtenie': dict(short='От чтения к говорению: художественный текст на уроке РКИ', speaker='Вера Степаненко, д. п. н., профессор МГУ'),
 'myau': dict(short='Кто сказал «мяу»? Урок РКИ о животных', speaker='Любовь Сираждинова'),
 'storytelling': dict(short='Сторителлинг на уроке РКИ', speaker=''),
 'nils': dict(short='Нильс Всемогущий: спектакль и мастер-класс', speaker='Театр сторителлинга Константина Кожевникова'),
 'neyro': dict(short='Мозг, эмоции, мотивация', speaker='Елизавета Хамраева, д. п. н., профессор МПГУ'),
}
out = []
for k, e in EV.items():
    if k not in SHOWN: continue
    x = EXTRA.get(k, {})
    start = None
    if e.get('day') and e.get('mon'):
        hh, mm = (e.get('time') or '18:00').split(':')
        start = f"{YEAR}-{int(e['mon']):02d}-{int(e['day']):02d}T{int(hh):02d}:{mm}:00+03:00"
    slug = SL.get(k)
    out.append(dict(id=k, short=x.get('short') or e['title'].split(':')[0], title=e['title'], speaker=x.get('speaker', ''),
                    start=start, url='https://calendar.rki.center/' + (slug or ''), rec=x.get('rec', ''), place=e.get('place', 'Онлайн')))
json.dump(dict(updated=__import__('datetime').date.today().isoformat(), events=out), open('events.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(out), 'events ->', 'events.json')
