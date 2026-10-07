<p align="center"><img src="assets/icon.png" width="96" alt=""></p>

# Sketchboard Wallpaper — powered by Excalidraw

Um quadro de desenho como papel de parede do Windows: desenhe e escreva direto na área de trabalho, sem Wallpaper Engine. O editor de desenho é o [Excalidraw](https://github.com/excalidraw/excalidraw).

> Projeto independente e não oficial, sem afiliação com o Excalidraw. "Excalidraw" é marca de seus respectivos donos e é citado aqui apenas para indicar a tecnologia usada.

## Como funciona

Uma única janela alterna entre dois modos:

| Modo | Onde fica | Interação |
| --- | --- | --- |
| Papel de parede (padrão) | Atrás dos ícones da área de trabalho (camada `WorkerW`) | Desenhe e digite direto na área de trabalho, como no Wallpaper Engine; os ícones continuam funcionando |
| Tela cheia | Por cima de tudo | Para desenhar com janelas abertas |

- Mouse sobre a área de trabalho vai para o quadro; o botão direito continua abrindo o menu do Windows e arrastar um ícone continua movendo o ícone.
- Com a área de trabalho em foco (clique nela ou Win+D), o teclado vai para o quadro, com acentos do layout ABNT2.
- **Ctrl+Alt+D** abre/fecha a tela cheia (ou duplo clique no ícone da bandeja).
- O desenho é salvo automaticamente (cena no `localStorage`, imagens no IndexedDB, em `%APPDATA%\sketchboard-wallpaper`).
- Menu da bandeja: desenhar, iniciar com o Windows, sair.

Tudo roda dentro do app: hooks globais de mouse e teclado (`src/main/input.js`), sem script nem servidor local.

## Instalar (usuários)

Baixe `Sketchboard Wallpaper Setup.exe` em Releases e abra. A instalação é em um clique, sem pedir administrador; o app abre na hora e passa a iniciar junto com o Windows (dá para desligar no ícone da bandeja). Para remover: Configurações > Aplicativos.

## Desenvolver

Requer Node.js 18+ e Windows 10/11.

```sh
npm install
npm start      # roda a partir do código
npm run dist   # gera o instalador em out/
```

## Estrutura

```
src/main/main.js      processo principal: modos, atalho, bandeja
src/main/desktop.js   chamadas Win32 (koffi) para entrar atrás dos ícones
src/main/input.js     repassa mouse/teclado da área de trabalho ao quadro
src/main/preload.js   ponte mínima entre a página e o processo principal
src/renderer/main.jsx app Excalidraw + salvamento
src/renderer/keyBridge.js entrega as teclas ao Excalidraw (acentos, edição de texto)
build/installer.nsh   desinstalador remove o início automático
build.mjs             empacota o renderer em dist/ (esbuild) e copia fontes e licenças
```

## Licença e créditos

- Este projeto: [MIT](LICENSE).
- [Excalidraw](https://github.com/excalidraw/excalidraw): MIT, © 2020 Excalidraw.
- Fontes incluídas (Excalifont, Virgil, Nunito, Lilita One, Assistant, Cascadia Code, Liberation Sans, Xiaolai): SIL Open Font License 1.1; Comic Shanns: MIT.
- Demais dependências e textos completos: [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). O mesmo arquivo vai junto no instalador.
