# HOSTINGG

Lokalny panel desktopowy do tworzenia i zarządzania serwerami Minecraft.

## Instalacja na CachyOS / Arch

```bash
sudo pacman -S --needed git nodejs npm rust jdk21-openjdk
git clone https://github.com/mrszymbox-art/minecraft-server-hosting.git
cd minecraft-server-hosting
./install.sh
```

Uruchom:
```bash
hostingg
```

Dane:
```text
~/.hostingg/servers/
~/.hostingg/backups/
```

## Co jest w tej wersji

- wiele serwerów
- Vanilla / Paper / Purpur / Fabric (Fabric wymaga dalszego dopracowania loadera)
- wersja Minecraft
- RAM
- limit graczy
- MOTD
- port
- Start / Stop / Restart
- live console
- pluginy z Hangar
- mody z Modrinth
- osobne katalogi serwerów
- aplikacja desktopowa Tauri

## Ważne

HOSTINGG uruchamia serwery lokalnie na komputerze. Nie jest to zewnętrzny hosting VPS.
Minecraft i pliki serwerowe nie są bundlowane z aplikacją.
