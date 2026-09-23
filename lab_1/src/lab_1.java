import java.awt.FlowLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.Calendar;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.SwingUtilities;

public class lab_1 extends JFrame {

    private final JButton buton1 = new JButton("0");
    private final JButton buton2 = new JButton("0");
    private final JButton buton3 = new JButton("0");

    private final Timer timer1 = new Timer();
    private final Timer timer2 = new Timer();
    private final Timer timer3 = new Timer();

    public lab_1() {
        setTitle("Laborator 1 - Timer");
        setSize(550, 200);
        setLocationRelativeTo(null);
        setLayout(new FlowLayout(FlowLayout.CENTER, 15, 20));
        setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);

        // Interfata: trei butoane
        add(new JLabel("Dupa 5 secunde:"));
        add(buton1);

        add(new JLabel("La ora stabilita:"));
        add(buton2);

        add(new JLabel("La fiecare 2 secunde:"));
        add(buton3);

        // Oprim toate timerele cand inchidem fereastra.
        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                timer1.cancel();
                timer2.cancel();
                timer3.cancel();
            }
        });

        pornesteTimerele();
    }

    private void pornesteTimerele() {

        // Timer 1: o singura executie dupa 5 secunde.
        timer1.schedule(new TimerTask() {
            @Override
            public void run() {
                incrementeazaButon(buton1);
                timer1.cancel();
            }
        }, 5000);

        // Timer 2: executie la un moment calendaristic.
        // Pentru testare, alegem ora curenta + 10 secunde.
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.SECOND, 10);

        Date oraProgramata = calendar.getTime();

        buton2.setToolTipText(
            "Momentul programat: " + oraProgramata
        );

        timer2.schedule(new TimerTask() {
            @Override
            public void run() {
                incrementeazaButon(buton2);
                timer2.cancel();
            }
        }, oraProgramata);

        // Timer 3: executie repetata la fiecare 2 secunde.
        // Continua pana la inchiderea ferestrei.
        timer3.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                incrementeazaButon(buton3);
            }
        }, 2000, 2000);
    }

    private void incrementeazaButon(JButton buton) {
        // Modificarile Swing se executa pe firul interfetei.
        SwingUtilities.invokeLater(() -> {
            if (isDisplayable()) {
                int valoare = Integer.parseInt(buton.getText());
                buton.setText(Integer.toString(valoare + 1));
            }
        });
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            lab_1 fereastra = new lab_1();
            fereastra.setVisible(true);
        });
    }
}