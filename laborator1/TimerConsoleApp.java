import java.awt.Toolkit;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Exemplu in mod consola pentru Lucrarea de laborator nr. 1:
 * Demonstreaza simultan cele 3 cerinte:
 * 1. Timer cu intarziere fixa (delay)
 * 2. Timer la un moment de timp exact (Date/Calendar)
 * 3. Timer cu perioada repetata (scheduleAtFixedRate)
 */
public class TimerConsoleApp {

    private static final SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss");

    public static void main(String[] args) {
        System.out.println("==========================================================");
        System.out.println("    Laborator 1: Planificarea Proceselor cu Timer-ul     ");
        System.out.println("==========================================================");
        System.out.println("Timp de start: " + sdf.format(new Date()));

        // 1. Timer cu perioada (Modul 3): la fiecare 1 secunda
        Timer timerPeriodic = new Timer("Thread-Periodic", false);
        timerPeriodic.scheduleAtFixedRate(new TimerTask() {
            private int count = 0;

            @Override
            public void run() {
                count++;
                System.out.println("[" + sdf.format(new Date()) + "] [Periodic] Bip #" + count + " (la fiecare 1 secunda)");
                Toolkit.getDefaultToolkit().beep();
            }
        }, 0, 1000);

        // 2. Timer cu intarziere (Modul 1): one-shot dupa 4 secunde
        Timer timerDelay = new Timer("Thread-Delay", false);
        timerDelay.schedule(new TimerTask() {
            @Override
            public void run() {
                System.out.println("[" + sdf.format(new Date()) + "] [Delay] >> Au trecut 4 secunde! Sarcina Delay executata.");
            }
        }, 4000);

        // 3. Timer la o ora/data exacta (Modul 2): programat peste 7 secunde de la start
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.SECOND, 7);
        Date oraFixa = calendar.getTime();

        Timer timerExact = new Timer("Thread-Exact", false);
        timerExact.schedule(new TimerTask() {
            @Override
            public void run() {
                System.out.println("[" + sdf.format(new Date()) + "] [Exact Time] >> S-a atins momentul programat: " + sdf.format(oraFixa));
                System.out.println("[" + sdf.format(new Date()) + "] [Stop] Oprim toate timerele si incheiem programul.");
                
                // Oprire timere
                timerPeriodic.cancel();
                timerDelay.cancel();
                timerExact.cancel();
            }
        }, oraFixa);

        System.out.println("Toate cele 3 timere au fost initializate si planificate.");
    }
}
