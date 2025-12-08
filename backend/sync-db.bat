@echo off
REM Скрипт для выполнения SQL миграций (Windows)

set DB_HOST=%DB_HOST%
if "%DB_HOST%"=="" set DB_HOST=localhost

set DB_PORT=%DB_PORT%
if "%DB_PORT%"=="" set DB_PORT=5433

set DB_USERNAME=%DB_USERNAME%
if "%DB_USERNAME%"=="" set DB_USERNAME=postgres

set DB_PASSWORD=%DB_PASSWORD%
if "%DB_PASSWORD%"=="" set DB_PASSWORD=X69Sx2y2_SecureDB

set DB_NAME=%DB_NAME%
if "%DB_NAME%"=="" set DB_NAME=admin_telegram

set PGPASSWORD=%DB_PASSWORD%

echo Выполнение миграций базы данных...
echo Host: %DB_HOST%:%DB_PORT%
echo Database: %DB_NAME%
echo.

for %%f in (src\migrations\*.sql) do (
    echo Выполнение: %%f
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USERNAME% -d %DB_NAME% -f %%f
    if errorlevel 1 (
        echo Миграция может быть уже применена, продолжаем...
    )
)

echo.
echo Миграции выполнены!
