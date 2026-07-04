#!/usr/bin/env python3
"""Modifica o Podfile do Capacitor para desabilitar code signing nos Pods."""
import sys

podfile_path = sys.argv[1] if len(sys.argv) > 1 else 'Podfile'

with open(podfile_path, 'r') as f:
    content = f.read()

injection = """
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      end
    end"""

if 'assertDeploymentTarget(installer)' in content:
    content = content.replace(
        'assertDeploymentTarget(installer)',
        'assertDeploymentTarget(installer)' + injection
    )
    print("✅ Podfile modificado: CODE_SIGNING_ALLOWED=NO injetado apos assertDeploymentTarget")
elif 'post_install' in content:
    # Fallback: injetar antes do ultimo end
    lines = content.split('\n')
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == 'end':
            lines.insert(i, injection)
            break
    content = '\n'.join(lines)
    print("✅ Podfile modificado: CODE_SIGNING_ALLOWED=NO injetado antes do ultimo end")
else:
    # Nenhum post_install encontrado, adicionar um novo
    content += """

post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
      end
    end
end
"""
    print("✅ Podfile modificado: novo post_install adicionado")

with open(podfile_path, 'w') as f:
    f.write(content)
