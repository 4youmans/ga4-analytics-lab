# GA4 Analytics Lab

Учебный проект ОП.03 «Информационные технологии»: сайт, события GA4 и заявки в Google Таблице.

## Мой проект

- Репозиторий: https://github.com/4youmans/ga4-analytics-lab
- Сайт: https://ga4-analytics-lab-six.vercel.app
- Measurement ID: G-0L7H66CE9D — один Google Tag на каждой из четырёх HTML-страниц.
- Приёмник: собственный Apps Script Web App; адрес /exec установлен в action формы contacts.html.

Статический HTML/CSS/JavaScript. Сборка и установка пакетов не нужны. В существующем проекте Vercel: Framework Preset Other, Root Directory — корень, Build Command — пусто, Output Directory — точка.

## Страницы

| Страница | Назначение |
|---|---|
| index.html | Главная и кнопка открытия программы |
| about.html | Инструкция, скачивание памятки и справка GA4 |
| contacts.html | POST-форма с request_id и UTM |
| guide.html | Материал для Instagram-воронки; перенос меток к форме |

## События

| Событие | Условие и параметры |
|---|---|
| cta_click | Программа: button_name=program, page_section=hero; материал: guide_to_form, backend_guide |
| nav_click | Меню: link_text, from_page, link_url |
| utm_visit | В URL есть utm_source: utm_source, utm_medium, utm_campaign, landing_page |
| file_download_lab | Памятка: file_name, file_extension |
| external_resource_click | Справка: resource_name, link_domain |
| read_30s | 30 секунд видимой вкладки: page_path |
| scroll_75 | 75% доступной прокрутки, один раз на страницу: page_path |
| form_error | Невалидное поле: field_name, form_id |
| generate_lead | Отправка корректной настроенной формы: lead_source=contact_form |

page_view, form_start и form_submit собирает Google Tag / улучшенная статистика. Вторые ручные обработчики для них не добавляются. Имя и email передаются только приёмнику заявки, пользовательские события их не содержат.

## Форма и таблица

Заголовки листа leads: request_id, created_at, name, email, direction, utm_source, utm_medium, utm_campaign, status.

Код приёмника: apps-script/Code.gs. Функция setupLeadsSheet закрепляет заголовок, настраивает список new/in_progress/done/rejected, отклонение неверного статуса, подсветку дублей и пропусков. Существующие строки не удаляются; другая структура листа не перезаписывается.

Приёмник проверяет поля, email, направление, длину значений и UUID. Блокировка защищает проверку ID и запись от одновременных запросов. Дату и статус new устанавливает сервер. Текст защищён от превращения в формулы таблицы.

Повторная отправка без сброса использует тот же request_id. Новый ID создаётся после кнопки «Новая заявка». generate_lead означает попытку POST; факт сохранения проверяется отдельно по ID в таблице. Скрытый iframe не подтверждает успешную запись.

## Ссылки для проверки

- Отладка: https://ga4-analytics-lab-six.vercel.app/?debug_mode=true
- Telegram: https://ga4-analytics-lab-six.vercel.app/contacts.html?debug_mode=true&utm_source=telegram&utm_medium=social&utm_campaign=lesson07
- Instagram: https://ga4-analytics-lab-six.vercel.app/guide.html?debug_mode=true&utm_source=instagram&utm_medium=social&utm_campaign=backend_guide&utm_content=reel01

Отладка сохраняется при переходах по страницам. Материал переносит четыре UTM к форме; в таблице сохраняются три обязательные метки. Для прямого захода открыть contacts.html без меток. Новая вкладка не гарантирует новый сеанс GA4.

## Проверки

Локальные проверки без сетевых запросов: node --test tests/analytics.test.cjs

После публикации проверить тот же commit в Vercel, события в Realtime/DebugView и строки в собственной таблице. Обычные отчёты и исследования требуют обработки данных GA4.

Состояние тем курса: [docs/course-status.md](docs/course-status.md).
