# Laborator 1 - Tehnici de Programare a Sistemelor de Operare (SO)

## Tema lucrării
**Elaborarea unui mecanism de planificare a activității proceselor utilizând Timer-ul. Utilizarea mediului Git în grup.**

---

## 🎯 Obiective și Cerințe
Aplicația implementează planificarea proceselor folosind clasele standard Java `java.util.Timer` și `java.util.TimerTask`, acoperind toate cele 3 moduri specificate în sarcina de laborator:
1. **Reacție la un anumit interval de timp (Delay / One-shot)**: Execută sarcina o singură dată după scurgerea numărului de secunde specificat de utilizator.
2. **Reacție la un anumit timp (Ora / Data exactă)**: Execută sarcina la un moment calendaristic precis (`java.util.Date` și `java.util.Calendar`).
3. **Reacție cu o perioadă indicată (Repetitiv / Period)**: Execută sarcina la intervale regulate de timp (folosind `scheduleAtFixedRate`), actualizând progresul și starea procesului.

În plus, conform Criteriului 4 de evaluare, proiectul include o **interfață grafică completă (Java Swing GUI)** cu panouri interactive, butoane de start/oprire forțată (`cancel()`), bară de progres și jurnal de evenimente în timp real.

---

## 📁 Structura Fișierelor
- `ProcessSchedulerApp.java` - Aplicația completă cu Interfață Grafică (GUI) Swing.
- `TimerConsoleApp.java` - Versiune demonstrativă pentru consolă / terminal.
- `README.md` - Documentația proiectului și instrucțiunile de rulare.
- `RAPORT_LAB1.md` - Șablonul complet de raport pentru predare (conține răspunsurile la întrebările de verificare și capturile de ecran).

---

## 🚀 Compilare și Rulare

### 1. Rularea Aplicației cu Interfață Grafică (GUI)
```bash
javac ProcessSchedulerApp.java
java ProcessSchedulerApp
```

### 2. Rularea Aplicației în Consolă
```bash
javac TimerConsoleApp.java
java TimerConsoleApp
```

---

## 🛠️ Comenzi Git Recomandate pentru Laborator

### 1. Inițializare depozit local
```bash
git init
git branch -M main
```

### 2. Adăugare fișiere și primul commit
```bash
git add .
git commit -m "feat: Implementare planificator procese cu Timer si interfata Swing (Lab 1)"
```

### 3. Crearea unei ramuri separate (pentru lucrul în echipă)
```bash
git checkout -b feature/timer-scheduler
```

### 4. Conectarea la depozitul GitHub și publicarea codului (Push)
```bash
git remote add origin https://github.com/<UTILIZATOR_GITHUB>/<NUME_REPO>.git
git push -u origin main
git push -u origin feature/timer-scheduler
```
