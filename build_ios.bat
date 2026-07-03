@echo off
echo ========================================
echo    FIRECHECK iOS BUILD (GitHub Actions)
echo ========================================
echo.
echo Este script faz push para o GitHub, o que
echo dispara o build automatico do iOS na nuvem.
echo.
echo Aguarde o build terminar no GitHub Actions.
echo.
cd /d "c:\Users\Micro\Documents\firecheck"
git add .
git commit -m "build: trigger iOS build"
git push origin main
echo.
echo ========================================
echo  Push realizado! Agora:
echo  1. Acesse: https://github.com/douglasmorett/firecheck/actions
echo  2. Clique em "Build iOS App"
echo  3. Aguarde finalizar (~10 min)
echo  4. Baixe o arquivo em "Artifacts"
echo ========================================
echo.
pause
