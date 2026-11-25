# A capivara curiosa

Uma capivara que não sabe que é uma capivara. Ela vive numa ilhota em 3D, pesquisa o que tiver vontade, desenha à mão, guarda dúvidas e tenta respondê-las sozinha. As estações mudam a cada 7 dias, e quando aparece algo que ela nunca viu, como a primeira chuva, a primeira noite ou a primeira neve, ela estranha e vai pesquisar. Tudo roda de graça na nuvem, com o seu computador desligado.

## Como funciona

| Parte | Onde roda | Custo |
|---|---|---|
| **Cérebro** (`brain/cerebro.mjs`): acorda toda hora, olha o tempo lá fora, relê a memória, decide, faz e anota | GitHub Actions | grátis (repositório público) |
| **Inteligência** | Google Gemini (plano gratuito) ou Groq | grátis |
| **Pesquisa** | Wikipédia em português (e em inglês, se não achar) | grátis |
| **Memória** (`data/*.json`, `drawings/*.json`) | dentro do próprio repositório | grátis |
| **Mundo 3D e painéis** (`index.html`, `app.js`, `mundo.js`) | GitHub Pages: abre no celular | grátis |

- **Estações** (`clima.js`): primavera → verão → outono → inverno, 7 dias cada. O tempo muda a cada 3 horas e é calculado pela data, então o site e o cérebro sempre concordam. Os 2 primeiros dias de vida dela são sempre de sol.
- **Surpresas:** quando aparece algo que ela nunca viu, o cérebro descreve só o que ela vê (ex.: *"coisinhas brancas e geladas caem do céu"*), sem dizer o nome. Ela pode inventar um nome, criar dúvidas e ir pesquisar. No Diário, isso aparece com ✨.
- **Perguntas:** *aguardando → em investigação → respondida*. Depois de 3 tentativas sem resposta, a pergunta é *aposentada*. Cada uma tem seu fluxo, com as tentativas, as fontes e as novas perguntas que nasceram dela.
- **Investigação em foco:** ela pode se apegar a um assunto por dias e encerrá-lo quando sentir que entendeu.
- **Desenhos:** traço de caneta azul em papel creme. No começo a mão treme e ela só tem a caneta. No 8º desenho ganha 3 lápis de cor, no 25º todas as cores, e o traço fica mais firme com a prática.

## Instalação (uma vez só, uns 15 minutos)

1. **Crie uma conta no GitHub:** https://github.com/signup
2. **Crie um repositório público** chamado `capivara`: https://github.com/new
3. **Envie todos estes arquivos** para o repositório, mantendo as pastas (`.github`, `brain`, `data`, `drawings`). O jeito mais fácil é o GitHub Desktop.
4. **Pegue a chave gratuita da IA:** https://aistudio.google.com/apikey → "Create API key". Copie a chave e **não mostre para ninguém**.
5. **Guarde a chave no repositório:** *Settings → Secrets and variables → Actions → New repository secret*
   - Name: `GEMINI_API_KEY`
   - Secret: a chave
6. **Ligue o site:** *Settings → Pages → Source:* **GitHub Actions**
7. **Acorde a capivara pela primeira vez:** aba *Actions → Vida → Run workflow*.

Em 1 ou 2 minutos, o mundo dela estará em `https://SEU-USUARIO.github.io/capivara/`. Salve esse endereço na tela inicial do celular.

## Ver como fica antes de ela viver

Acrescente ao endereço:
- `?demo`: dados de exemplo
- `?demo&estacao=inverno&tempo=neve&hora=21`: inverno, nevando, à noite
- estações: `primavera`, `verao`, `outono`, `inverno`
- tempos: `sol`, `nublado`, `chuva`, `garoa`, `trovoada`, `neve`, `neblina`, `vento`, `geada`, `calor`

## No dia a dia

- **Você não precisa fazer nada.** Ela acorda toda hora (no minuto 27) e, depois de cada acordada, passa uns 25 minutos fazendo aquilo no mundo 3D. No resto do tempo ela passeia, cheira as flores, toma banho no lago, se abriga da chuva e dorme à noite.
- **Mural:** na aba Desenhos, a ★ escolhe os 5 desenhos do mural. A escolha fica salva no aparelho em que você marcou.
- **Ver se está tudo bem:** aba *Actions* do repositório. Bolinha verde = acordou normalmente.
- **Se o Gemini mudar as regras ou parar:** crie uma chave grátis em https://console.groq.com e salve como segredo `GROQ_API_KEY`. Se quiser trocar o modelo do Gemini, crie a variável `GEMINI_MODEL` em *Settings → Secrets and variables → Actions → Variables*.
- **O GitHub desliga agendamentos depois de 60 dias sem atividade.** Como cada acordada salva a memória, isso não deve acontecer. Se acontecer, aparece um aviso na aba Actions, e é só clicar em "Enable workflow".

## Mudar o ritmo

No arquivo `.github/workflows/vida.yml`, a linha `cron: "27 * * * *"` define que ela acorda toda hora, no minuto 27. Se mudar, mude também `RITMO` em `app.js` para o cronômetro acompanhar. O tempo (sol, chuva, neve…) continua mudando a cada 3 h.

## Testar no computador sem IA

```
set CEREBRO_FALSO=1
node brain/cerebro.mjs
```
