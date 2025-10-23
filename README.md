Felhasználói dokumentáció
Cél:
Az alkalmazás célja, hogy PDF fájlokból, élelmiszer leírásokból automatikusan kinyerje az allergén- és tápérték információkat. A PDF fájl lehet szöveges, vagy képes formátumú. A kinyert adatok táblázatban, valamint nyers, másolható JSON formátumban is megjelennek a weboldalon. 
Használat:
1.	Nyisd meg a weboldalt
2.	Válaszd ki a feldolgozandó PDF-et. A program automatikusan feldolgozza azt.
3.	Az eredmény 3 részben jelenik meg: allergének, tápértékek, JSON
(ha a dokumentum scannelt, a Force OCR kapcsolóval kényszeríthető OCR feldolgozás)
Hibák:
Hibaüzenet	Jelentése	Megoldás
No file uploaded	Nem választottál fájlt	Tölts fel egy fájlt
Only PDF files are allowed	Nem PDF formátumot próbálsz feltölteni	Tölts fel egy PDF formátumú fájlt
No meaningful text (parse+OCR)	PDF üres, vagy nincs elég sok értelmes szöveg	Próbálj meg egy nagyobb tartalmú PDF-et

 
Fejlesztői dokumentáció
Telepítés
1.	Töltsd le a projektet
2.	Telepítsd a függőségeket:
npm install express multer tesseract.js pdf-parse sharp tmp openai dotenv cors
3.	Telepítsd a Poppler-t
4.	Hozz létre egy .env fájlt, helyezd el benne az API kulcsot
Kapcsolók
•	Képes PDF fájlok esetén az OCR lehetséges, hogy nem működik megfelelően. Az OCR_DPI konstans változtatásával módosíthatjuk a képek felbontását, ezzel segítve a beolvasást, vagy módosíthatjuk az előfeldolgozást.
Működés
1.	A felhasználó kiválaszt egy fájlt
2.	A weboldal HTTP POST kérést küld a szerver felé a /upload endpointtal
3.	A szerver a Multer csomag segítségével fogadja a fájlt a memóriába
4.	Ellenőrzi, hogy PDF típusú-e, javítja a fájlnév kódolását
5.	A szerver megpróbálja közvetlenül kiolvasni a PDF szövegét
6.	Ellenőrzi, elég értelmes karaktert tartalmaz-e a szöveg
7.	Szükség esetén Tesseract OCR feldolgozás
a.	pdftoppm PNG képekké alakítja a PDF-et
b.	a sharp könyvtár előfeldolgozza a képeket a könnyebb olvashatóság érdekében
c.	A Tesseract felismeri a szöveget
d.	Az eredményt regex-el megtisztítja
8.	Adatkinyerés OpenAI segítségével
9.	A szerver elküldi a választ a kliensnek rendezett JSON válaszban
10.	Az eredményt a böngésző megjeleníti
Kliens-szerver kapcsolatok
Route	Metódus	Leírás
/upload	POST	Fájlt feltöltése, elemzése
/extract-text	POST	PDF/OCR szöveg visszaadása
/	GET	„hello” teszt

