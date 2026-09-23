import java.awt.FlowLayout;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;

public class lab_1 {

    public static void main(String[] args) {
        SwingUtilities.invokeLater(new Runnable() {
            @Override
            public void run() {
                creeazaFereastra();
            }
        });
    }

    public static void creeazaFereastra() {
        JFrame fereastra = new JFrame("Laborator 1 - Timere");
        fereastra.setLayout(new FlowLayout());
        fereastra.setSize(550, 150);
        fereastra.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JButton b1 = new JButton("Dupa 5 secunde: 0");
        JButton b2 = new JButton("La ora stabilita: 0");
        JButton b3 = new JButton("Periodic: 0");

        fereastra.add(b1);
        fereastra.add(b2);
        fereastra.add(b3);

        fereastra.setLocationRelativeTo(null);
        fereastra.setVisible(true);

        Timer t1 = new Timer();
        Timer t2 = new Timer();
        Timer t3 = new Timer();

        // Prima actiune: dupa 5 secunde.
        t1.schedule(new TimerTask() {
            @Override
            public void run() {
                SwingUtilities.invokeLater(new Runnable() {
                    @Override
                    public void run() {
                        b1.setText("Dupa 5 secunde: 1");
                    }
                });

                t1.cancel();
            }
        }, 5000);

        // A doua actiune: la un moment stabilit.
        Date ora = new Date(System.currentTimeMillis() + 10000);
        b2.setToolTipText("Ora programata: " + ora);

        t2.schedule(new TimerTask() {
            @Override
            public void run() {
                SwingUtilities.invokeLater(new Runnable() {
                    @Override
                    public void run() {
                        b2.setText("La ora stabilita: 1");
                    }
                });

                t2.cancel();
            }
        }, ora);

        // A treia actiune: la fiecare 2 secunde.
        t3.scheduleAtFixedRate(new TimerTask() {
            private int contor = 0;

            @Override
            public void run() {
                SwingUtilities.invokeLater(new Runnable() {
                    @Override
                    public void run() {
                        contor++;
                        b3.setText("Periodic: " + contor);
                    }
                });
            }
        }, 2000, 2000);
    }
}