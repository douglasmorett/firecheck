#!/usr/bin/env python3
"""Modifica o project.pbxproj para definir manual signing com o UUID do profile correto."""
import sys
import re

if len(sys.argv) < 3:
    print("Uso: fix_project_signing.py <caminho_project.pbxproj> <UUID_do_provisioning_profile>")
    sys.exit(1)

pbxproj_path = sys.argv[1]
pp_uuid = sys.argv[2]
team_id = "5K9U9AF594"

print(f"Modificando {pbxproj_path} com UUID: {pp_uuid}...")

with open(pbxproj_path, 'r') as f:
    content = f.read()

# Dividir o arquivo em blocos de XCBuildConfiguration
# Cada configuracao comeca com algo como: 504EC3171FED79650016851F /* Debug */ = {
# E vai ate a proxima declaracao ou o final da sessao.

# Vamos encontrar o inicio da secao XCBuildConfiguration
start_section = content.find("/* Begin XCBuildConfiguration section */")
end_section = content.find("/* End XCBuildConfiguration section */")

if start_section == -1 or end_section == -1:
    print("ERRO: Secao XCBuildConfiguration nao encontrada")
    sys.exit(1)

section_text = content[start_section:end_section]

# Vamos dividir a secao em blocos XCBuildConfiguration individuais.
# Cada bloco termina com "};" no nivel principal do bloco.
blocks = re.split(r'(\t*[0-9A-Fa-f]{24}\s*/\*.*?\*/\s*=\s*\{)', section_text)

# O primeiro elemento nao e um bloco completo (e o cabecalho).
# Depois, cada par de elementos (match, conteudo) representa um bloco.
modified_section = blocks[0]
for i in range(1, len(blocks), 2):
    header = blocks[i]
    body = blocks[i+1]
    
    # Se o bloco pertence ao target App (contem com.grupohakim.firecheck)
    if "com.grupohakim.firecheck" in body:
        print(f"Modificando bloco de configuracao: {header.strip()}")
        
        # Mudar Automatic para Manual
        body = body.replace("ProvisioningStyle = Automatic;", "ProvisioningStyle = Manual;")
        body = body.replace("CODE_SIGN_STYLE = Automatic;", "CODE_SIGN_STYLE = Manual;")
        
        # Remover definicoes antigas para evitar duplicacao
        for key in ["DEVELOPMENT_TEAM", "DevelopmentTeam", "CODE_SIGN_IDENTITY", "PROVISIONING_PROFILE", "PROVISIONING_PROFILE_SPECIFIER"]:
            # Remover linha correspondente
            body = re.sub(rf'\t*{key}\s*=\s*.*?;[^\n]*\n', '', body)
            # Versoes com aspas
            body = re.sub(rf'\t*"{key}"\s*=\s*.*?;[^\n]*\n', '', body)
            
        # Inserir novas configuracoes no inicio do bloco buildSettings = {
        new_settings = f"""\n\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tDEVELOPMENT_TEAM = {team_id};
\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "FireCheck App Store";
\t\t\t\t"PROVISIONING_PROFILE" = "{pp_uuid}";"""
        
        body = body.replace("buildSettings = {", "buildSettings = {" + new_settings)
        
    modified_section += header + body

# Substituir a secao modificada no conteudo original
new_content = content[:start_section] + modified_section + content[end_section:]

with open(pbxproj_path, 'w') as f:
    f.write(new_content)

print("✅ project.pbxproj modificado com sucesso!")
