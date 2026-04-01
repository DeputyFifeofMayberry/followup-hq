@echo off
set SRC=C:\Users\barne\Desktop\followup-hq
set OUT=C:\Users\barne\Desktop\followup-hq-upload
set ZIP=C:\Users\barne\Desktop\followup-hq-upload.zip

if exist "%OUT%" rmdir /s /q "%OUT%"
if exist "%ZIP%" del /q "%ZIP%"

robocopy "%SRC%" "%OUT%" /E /XD node_modules dist target .git .vite src-tauri\target
powershell -Command "Compress-Archive -Path '%OUT%\*','%OUT%\.env.local' -DestinationPath '%ZIP%' -Force"
echo Done.
pause