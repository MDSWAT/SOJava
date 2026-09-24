# RAPORT DE LABORATOR NR. 1

**Disciplina:** Sisteme de Operare (SO)  
**Tema:** Elaborarea unui mecanism de planificare a activității proceselor utilizând Timer-ul. Utilizarea mediului Git în grup.  
**Student:** [Nume Prenume]  
**Grupa:** [Grupa dvs., ex: CR-221]  
**Link Depozit GitHub:** `https://github.com/[UTILIZATOR]/[NUME_REPOSITORIU]`  

---

## 1. Obiectivele Lucrării
1. Însușirea modalităților de creare a mecanismelor de planificare a proceselor/sarcinilor în Java folosind clasa `Timer` și `TimerTask`.
2. Însușirea modalităților de prelucrare, pornire și oprire a mecanismului de planificare.
3. Utilizarea platformei GitHub și a sistemului de versionare Git pentru colaborarea în echipă pe ramuri de dezvoltare.

---

## 2. Sarcina de Lucru
Să se creeze o aplicație cu mai multe timere utilizând clasele `Timer` și `TimerTask` în diferite moduri:
1. **Reacție la un anumit interval de timp** (one-shot după o întârziere / delay specificat).
2. **Reacție la un anumit timp** (la o oră / dată exactă din zi).
3. **Reacție cu o perioadă indicată** (repetitiv la intervale regulate de timp).
4. **Construirea unei interfețe** a programului (interfață grafică interactivă Swing GUI).

---

## 3. Descrierea Implementării și a Claselor Folosite

Aplicația a fost dezvoltată în limbajul **Java** și este compusă din două module principale:
- `ProcessSchedulerApp.java`: Oferă o interfață grafică modernă realizată cu biblioteca standard **Java Swing** (`JFrame`, `JButton`, `JProgressBar`, `JSpinner`, `JTextArea`).
- `TimerConsoleApp.java`: Demonstrează execuția sincronizată a celor 3 moduri în consolă.

### 3.1. Clasa `Timer` și `TimerTask`
- `java.util.TimerTask`: Reprezintă o sarcină (task) care implementează interfața `Runnable`. Conține metoda abstractă `run()`, în care se definește codul ce va fi executat la declanșarea timerului.
- `java.util.Timer`: Reprezintă firul de execuție (thread) de fundal care se ocupă cu planificarea și execuția automată a obiectelor `TimerTask`.

### 3.2. Cele 3 moduri de planificare implementate:

1. **Modul 1: Timer cu întârziere (Delay / One-Shot)**
   - Metoda folosită: `schedule(TimerTask task, long delay)`
   - Rol: Pornește o numărătoare inversă pe baza numărului de secunde introdus de utilizator. Când timpul expiră, metoda `run()` execută notificarea acustică (`Toolkit.beep()`), schimbă starea pe interfață și înregistrează mesajul în jurnal.
   - Oprire: Poate fi oprit înainte de scurgerea timpului prin apelarea metodei `cancel()`.

2. **Modul 2: Timer la moment de timp exact (Date / Calendar)**
   - Metoda folosită: `schedule(TimerTask task, Date time)`
   - Rol: Calculează un moment calendaristic precis folosind `Calendar.getInstance()` și programează sarcina să ruleze exact când ceasul de sistem atinge acea dată/oră.

3. **Modul 3: Timer periodic cu perioadă specificată (Periodic / Repeated)**
   - Metoda folosită: `scheduleAtFixedRate(TimerTask task, long delay, long period)`
   - Rol: Execută în mod repetat sarcina la fiecare $T$ milisecunde (de exemplu, 1000 ms). La fiecare pas, se incrementează un contor, se actualizează progresul în `JProgressBar` și se scrie în logul aplicației.
   - Oprire: Oprit la cerere prin butonul dedicat folosind metoda `timerPeriodic.cancel()`.

---

## 4. Răspunsuri la Întrebările de Verificare

### 1. Ce este GIT?
**Răspuns:**  
Git este un sistem de control al versiunilor distribuit (DVCS - Distributed Version Control System), gratuit și open-source, conceput pentru a gestiona istoricul modificărilor aduse fișierelor dintr-un proiect. Spre deosebire de sistemele centralizate, fiecare dezvoltator deține o copie completă (clonă) a întregului istoric al depozitului.

### 2. Componentele de bază în GIT?
**Răspuns:**  
- **Working Directory (Directorul de lucru):** Fișierele reale de pe disc pe care le modificăm.
- **Staging Area / Index (Zona de pregătire):** Zona intermediară unde fișierele sunt adăugate (`git add`) înainte de a fi salvate definitiv.
- **Local Repository (.git folder):** Baza de date locală unde se stochează commit-urile, ramurile și istoricul.
- **Remote Repository (Depozitul la distanță, ex. GitHub):** Serverul central unde se sincronizează modificările echipei (`push`/`pull`).

### 3. Funcțiile de bază a lui GIT?
**Răspuns:**  
- `git init`: Inițializează un depozit local nou.
- `git clone`: Descarcă o copie completă a unui depozit de pe un server remote.
- `git status`: Verifică starea fișierelor (modificate, adăugate în index, nesubmisiuni).
- `git add`: Adaugă modificările în Staging Area.
- `git commit`: Salvează un instantaneu (snapshot) al modificărilor în depozitul local.
- `git branch` & `git checkout` / `switch`: Crearea și comutarea între ramuri paralele de lucru.
- `git merge`: Îmbinarea modificărilor dintr-o ramură în alta.
- `git pull` & `git push`: Sincronizarea modificărilor cu depozitul la distanță.

### 4. Dați definiția unui Timer.
**Răspuns:**  
În Java, un `Timer` este o componentă / fir de execuție (thread) care permite planificarea execuției viitoare a uneia sau mai multor sarcini (`TimerTask`), fie o singură dată (la un anumit moment sau după un interval de întârziere), fie în mod periodic, la intervale regulate de timp.

### 5. Pentru ce este folosită metoda `schedule()` și din ce clasă Java ea vine?
**Răspuns:**  
Metoda `schedule()` provine din clasa `java.util.Timer` (sau `javax.swing.Timer` în Swing). În `java.util.Timer`, metoda este supraîncărcată și este folosită pentru a planifica execuția unui obiect de tip `TimerTask` la un moment specificat în viitor sau la o rată cu întârziere fixă (fixed-delay).

### 6. Enumerați pașii care trebuie urmați pentru crearea unui timer.
**Răspuns:**  
1. Crearea unei subclase care extinde `TimerTask` (sau o clasă anonimă / lambda) și suprascrierea metodei `run()` cu instrucțiunile dorite.
2. Instanțierea clasei `Timer` (crearea firului de execuție al timerului): `Timer t = new Timer();`.
3. Instanțierea obiectului de tip acțiune (`TimerTask`).
4. Planificarea execuției prin apelarea uneia dintre metodele clasei `Timer`, precum `schedule()` sau `scheduleAtFixedRate()`, transmițând sarcina, timpul/întârzierea și opțional perioada.

### 7. Care este diferența dintre metoda `schedule()` și `scheduleAtFixedRate()`?
**Răspuns:**  
- **`schedule()` (Fixed-delay execution):** Fiecare execuție succesivă este programată în raport cu timpul de execuție **real** al acțiunii precedente. Dacă o execuție este întârziată (de exemplu, din cauza supraîncărcării procesorului sau a blocajelor), execuțiile următoare vor fi amânate proporțional.
- **`scheduleAtFixedRate()` (Fixed-rate execution):** Fiecare execuție este programată în raport cu timpul de start inițial. Dacă o execuție întârzie, execuțiile următoare sunt declanșate într-o succesiune rapidă („catch-up”) pentru ca numărul total de execuții într-o unitate de timp să rămână constant. Este ideală pentru animații, ceasuri sau monitorizare în timp real.

### 8. Când se oprește executarea unui timer?
**Răspuns:**  
- Pentru o sarcină unică (one-shot), timerul își finalizează acțiunea odată ce metoda `run()` a sarcinii s-a terminat.
- Dacă timerul a fost creat ca fir de execuție „daemon” (`new Timer(true)`), acesta se oprește automat când toate celelalte fire non-daemon ale aplicației au fost terminate.
- Când se apelează explicit metoda `cancel()` pe sarcina respectivă (`task.cancel()`) sau pe întregul timer (`timer.cancel()`).

### 9. Ce metode se folosesc pentru oprirea forțată a unui timer?
**Răspuns:**  
- `timer.cancel()`: Oprește firul timerului și anulează toate sarcinile planificate pe acesta.
- `timerTask.cancel()`: Anulează doar sarcina respectivă (dacă este periodică, nu se va mai declanșa).
- `System.exit(0)`: Termină întregul proces JVM, oprind forțat toate firele de execuție active.

---

## 5. Rezultate Obținute și Capturi de Ecran

### 5.1. Rularea în mod Consolă (`TimerConsoleApp`)
```text
==========================================================
    Laborator 1: Planificarea Proceselor cu Timer-ul     
==========================================================
Timp de start: 15:48:58
Toate cele 3 timere au fost initializate si planificate.
[15:48:58] [Periodic] Bip #1 (la fiecare 1 secunda)
[15:48:59] [Periodic] Bip #2 (la fiecare 1 secunda)
[15:49:00] [Periodic] Bip #3 (la fiecare 1 secunda)
[15:49:01] [Periodic] Bip #4 (la fiecare 1 secunda)
[15:49:02] [Periodic] Bip #5 (la fiecare 1 secunda)
[15:49:02] [Delay] >> Au trecut 4 secunde! Sarcina Delay executata.
[15:49:03] [Periodic] Bip #6 (la fiecare 1 secunda)
[15:49:04] [Periodic] Bip #7 (la fiecare 1 secunda)
[15:49:05] [Periodic] Bip #8 (la fiecare 1 secunda)
[15:49:05] [Exact Time] >> S-a atins momentul programat: 15:49:05
[15:49:05] [Stop] Oprim toate timerele si incheiem programul.
```

### 5.2. Rularea Interfeței Grafice (`ProcessSchedulerApp`)
Interfața grafică permite:
- Selectarea numărului de secunde de întârziere (Delay) și declanșarea sarcinii unice.
- Programarea sarcinii la o oră exactă din viitor folosind `Calendar`.
- Pornirea și oprirea la cerere a monitorizării periodice, cu vizualizarea progresului într-o componentă `JProgressBar`.
- Vizualizarea jurnalului complet de evenimente cu timestamp în componenta `JTextArea`.

---

## 6. Concluzii
În cadrul acestei lucrări de laborator am aprofundat conceptele legate de planificarea proceselor și firelor de execuție în sistemele de operare, utilizând abstractizările oferite de limbajul Java (`Timer` și `TimerTask`). S-a demonstrat diferența practică dintre planificarea cu întârziere fixă, planificarea la oră absolută și execuția repetitivă la rată fixă. De asemenea, au fost utilizate bunele practici de versionare a codului în Git prin ramificări (`branching`), comiteri atomice (`commits`) și publicarea pe platforma GitHub.
