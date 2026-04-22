@echo off
echo Atualizando o FireCheck...
git add .
git commit -m "Fix: Politica de Privacidade e Redirecionamentos 404"
git push
echo.
echo Tudo pronto! O site sera atualizado em segundos na Vercel.
pause

