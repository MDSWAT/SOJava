
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Font;
import java.util.Calendar;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;

public class Main {
    static JTextArea textArea;
    static JLabel statusLabel;
    static Timer timer1;
    static Timer timer2;
    static Timer timer3;

    public static void main(String[] args) {
        JFrame frame = new JFrame("Aplicație cu mai multe Timere");
        frame.setSize(600, 450);
        frame.setDefaultCloseOperation(3);
        frame.setLocationRelativeTo((Component)null);
        JLabel title = new JLabel("Aplicație cu clasele Timer și TimerTask");
        title.setFont(new Font("Arial", 1, 20));
        title.setHorizontalAlignment(0);
        textArea = new JTextArea();
        textArea.setFont(new Font("Arial", 0, 16));
        textArea.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(textArea);
        statusLabel = new JLabel("Timerele nu sunt pornite.");
        statusLabel.setHorizontalAlignment(0);
        JButton startButton = new JButton("Pornește timerele");
        JButton stopButton = new JButton("Oprește timerele");
        JButton clearButton = new JButton("Șterge rezultatele");
        JPanel buttonPanel = new JPanel();
        buttonPanel.add(startButton);
        buttonPanel.add(stopButton);
        buttonPanel.add(clearButton);
        frame.setLayout(new BorderLayout(10, 10));
        frame.add(title, "North");
        frame.add(scrollPane, "Center");
        frame.add(buttonPanel, "South");
        JPanel bottomPanel = new JPanel(new BorderLayout());
        bottomPanel.add(statusLabel, "North");
        bottomPanel.add(buttonPanel, "South");
        frame.add(bottomPanel, "South");
        frame.setVisible(true);
        startButton.addActionListener((e) -> {
            if (timer1 == null && timer2 == null && timer3 == null) {
                statusLabel.setText("Timerele sunt pornite.");
                textArea.append("====================================\n");
                textArea.append("Timerele au fost pornite!\n");
                textArea.append("====================================\n");
                timer1 = new Timer();
                timer1.schedule(new TimerTask() {
                    public void run() {
                        SwingUtilities.invokeLater(() -> Main.textArea.append("Timer 1: Au trecut 5 secunde!\n"));
                        Main.timer1.cancel();
                        Main.timer1 = null;
                    }
                }, 5000L);
                timer2 = new Timer();
                Calendar calendar = Calendar.getInstance();
                calendar.set(11, 16);
                calendar.set(12, 13);
                calendar.set(13, 0);
                Date timp = calendar.getTime();
                if (timp.before(new Date())) {
                    calendar.add(5, 1);
                    timp = calendar.getTime();
                }

                timer2.schedule(new TimerTask() {
                    public void run() {
                        SwingUtilities.invokeLater(() -> Main.textArea.append("Timer 2: A fost atins timpul stabilit!\n"));
                        Main.timer2.cancel();
                        Main.timer2 = null;
                    }
                }, timp);
                timer3 = new Timer();
                timer3.scheduleAtFixedRate(new TimerTask() {
                    int counter = 0;

                    public void run() {
                        ++this.counter;
                        int numarExecutie = this.counter;
                        SwingUtilities.invokeLater(() -> Main.textArea.append("Timer 3: Execuția nr. " + numarExecutie + "\n"));
                        if (this.counter == 5) {
                            SwingUtilities.invokeLater(() -> Main.textArea.append("Timer 3: S-a oprit după 5 execuții.\n"));
                            Main.timer3.cancel();
                            Main.timer3 = null;
                        }

                    }
                }, 0L, 2000L);
            } else {
                textArea.append("Timerele sunt deja pornite!\n");
            }

        });
        stopButton.addActionListener((e) -> {
            if (timer1 != null) {
                timer1.cancel();
                timer1 = null;
            }

            if (timer2 != null) {
                timer2.cancel();
                timer2 = null;
            }

            if (timer3 != null) {
                timer3.cancel();
                timer3 = null;
            }

            statusLabel.setText("Timerele au fost oprite.");
            textArea.append("\nToate timerele au fost oprite.\n");
        });
        clearButton.addActionListener((e) -> textArea.setText(""));
    }
}
