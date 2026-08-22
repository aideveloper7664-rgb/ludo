# Ludo Game (2/3/4 Players — Local Hotseat)

Real Ludo assets ke saath banaya gaya ek pura HTML5/JS Ludo game. Koi build
step nahi chahiye — sirf static files hain, kisi bhi static host pe chal
jaayega.

## Features
- 2, 3 ya 4 players (ek hi device pe baari-baari se khelo — "hotseat" mode)
- Sahi Ludo rules: 6 pe base se nikalna, extra chaal 6 pe, lagatar 3 chhakke
  pe baari khatam, safe cells (star wale) pe capture nahi, capture hone par
  pawn wapas base
- Asli board/pawn/dice assets, sound effects, background music toggle
- Mobile-friendly responsive layout

## Local test karne ke liye
Kisi bhi static server se chala sakte ho, jaise:

```bash
python3 -m http.server 8000
```

phir browser me `http://localhost:8000` kholo.

(Seedha `index.html` file double-click karke bhi khul sakta hai, lekin
kuch browsers file:// se audio/asset loading me dikkat karte hain — isliye
local server ya proper hosting recommended hai.)

## GitHub Pages pe host karna
1. Ek naya GitHub repo banao (public).
2. Is folder ke saare files (assets/, index.html, style.css, game.js,
   board-data.js, ui.js) us repo me push kar do.
3. Repo Settings → Pages → Source: `main` branch, `/ (root)` select karo.
4. Kuch minute me `https://<username>.github.io/<repo-name>/` pe live ho
   jaayega.

## Netlify / Vercel pe host karna
Bas is poore folder ko drag-and-drop kar do (Netlify "Deploy manually")
ya repo connect karke deploy karo — koi build command nahi chahiye
(static site).

## File structure
```
index.html      - saare screens (home, game, quit/result popups)
style.css       - styling
board-data.js   - board ke 15x15 grid coordinates (ring path, home columns,
                   safe cells, base slots) — pixel-analysis se nikaale gaye
game.js         - game engine: dice, movement, capture, win rules
ui.js           - DOM/rendering, dice roll animation, click handling
assets/         - original asset pack (board, pawns, dice, sounds, fonts)
```
