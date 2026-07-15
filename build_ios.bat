@echo off
echo ===================================================
echo       FIRECHECK iOS BUILD (App Store / TestFlight)
echo ===================================================
echo.
echo 1. Incrementando build version (CURRENT_PROJECT_VERSION)...
node scripts/bump_version.cjs
echo.
echo 2. Enviando alteracoes para o GitHub...
cd /d "c:\Users\Micro\Documents\firecheck"
git add .
git commit -m "build: trigger iOS signed build"
git push origin main
echo.
echo ===================================================
echo  Push realizado com sucesso!
echo  Agora faca o seguinte no GitHub:
echo.
echo  1. Acesse: https://github.com/douglasmorett/firecheck/actions
echo  2. Clique em: "Build and Sign iOS IPA (App Store / TestFlight)"
echo  3. Clique no botao "Run workflow" (a direita) e confirme
echo  4. Aguarde finalizar (~10 a 15 min)
echo  5. O GitHub enviara o app assinado direto para o TestFlight!
echo     (Aguarde mais uns 5 min para a Apple processar o build)
echo ===================================================
echo.
pause
