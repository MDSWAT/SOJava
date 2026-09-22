import java.util.Timer;
import java.util.TimerTask;

public class lab_1 {
    public static void main(String[] args) {
        Timer timer = new Timer();

        TimerTask actiune = new TimerTask() {
            @Override
            public void run() {
                System.out.println("Au trecut 5 secunde!");
                timer.cancel();
            }
        };

        System.out.println("Timer pornit. Asteptam 5 secunde...");
        timer.schedule(actiune, 5000);
    }
}