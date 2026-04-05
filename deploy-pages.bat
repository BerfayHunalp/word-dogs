@echo off
cd /d "C:\Users\ISIM NICE\wardogs"
echo Creating Pages project...
call npx wrangler pages project create word-dogs --production-branch main
echo Deploying frontend...
call npx wrangler pages deploy . --project-name word-dogs
echo Done!
pause
