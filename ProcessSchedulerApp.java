import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

/**
 * Stefan a facut un prigram
 * 
 * Lucrare de laborator nr. 1
 * Tema: Elaborarea unui mecanism de planificare a activitatii proceselor utilizand Timer-ul.
 *
 * Aplicatia demonstreaza utilizarea claselor java.util.Timer si java.util.TimerTask
 * pentru cele 3 moduri de planificare solicitate:
 * 1. Planificare la un anumit interval de timp (delay / one-shot).
 * 2. Planificare la un anumit timp fix (ora / data exacta).
 * 3. Planificare cu o perioada indicata (repetitiv la interval fix).
 */
public class ProcessSchedulerApp extends JFrame {

    // Timere si task-uri pentru cele 3 moduri
    private Timer timerDelay;
    private Timer timerExact;
    private Timer timerPeriodic;

    // Componente Interfata Grafica (GUI)
    private JTextArea logArea;
    private JProgressBar progressBar;
    private JLabel lblStatusDelay;
    private JLabel lblStatusExact;
    private JLabel lblStatusPeriodic;

    private JButton btnStartDelay;
    private JButton btnCancelDelay;
    private JButton btnStartExact;
    private JButton btnCancelExact;
    private JButton btnStartPeriodic;
    private JButton btnStopPeriodic;

    private JSpinner spinnerDelay;
    private JSpinner spinnerExactSeconds;
    private JSpinner spinnerPeriod;

    private int periodicCounter = 0;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss");

    public ProcessSchedulerApp() {
        super("Planificator Procese cu Timer & TimerTask - Lab 1");
        initComponents();
    }

    private void initComponents() {
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(780, 620);
        setLocationRelativeTo(null);
        setLayout(new BorderLayout(10, 10));

        // Panou de titlu
        JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(new Color(33, 50, 80));

        JLabel titleLabel = new JLabel("Planificarea Activitatii Proceselor (Timer & TimerTask)");
        titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 16));
        titleLabel.setForeground(Color.WHITE);
        titleLabel.setBorder(new EmptyBorder(12, 15, 12, 10));
        headerPanel.add(titleLabel, BorderLayout.WEST);

        JLabel authorLabel = new JLabel("Made by Stefan");
        authorLabel.setFont(new Font("Segoe UI", Font.BOLD | Font.ITALIC, 13));
        authorLabel.setForeground(new Color(210, 230, 255));
        authorLabel.setBorder(new EmptyBorder(12, 10, 12, 15));
        headerPanel.add(authorLabel, BorderLayout.EAST);

        add(headerPanel, BorderLayout.NORTH);

        // Panou central cu 3 carduri (cate unul pentru fiecare tip de Timer)
        JPanel mainPanel = new JPanel(new GridLayout(3, 1, 10, 10));
        mainPanel.setBorder(new EmptyBorder(10, 15, 10, 15));

        // -------------------------------------------------------------
        // MOD 1: Timer la un anumit interval (Delay)
        // -------------------------------------------------------------
        JPanel panel1 = new JPanel(new BorderLayout(8, 8));
        panel1.setBorder(BorderFactory.createTitledBorder("1. Executie dupa un anumit interval (Delay - One-Shot)"));
        
        JPanel p1Controls = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 5));
        p1Controls.add(new JLabel("Timp intarziere (secunde):"));
        spinnerDelay = new JSpinner(new SpinnerNumberModel(5, 1, 60, 1));
        p1Controls.add(spinnerDelay);

        btnStartDelay = new JButton("Porneste Timer Delay");
        btnCancelDelay = new JButton("Opreste Timer");
        btnCancelDelay.setEnabled(false);
        p1Controls.add(btnStartDelay);
        p1Controls.add(btnCancelDelay);

        lblStatusDelay = new JLabel("Stare: Inactiv");
        lblStatusDelay.setForeground(new Color(80, 80, 80));
        p1Controls.add(lblStatusDelay);
        panel1.add(p1Controls, BorderLayout.CENTER);

        // -------------------------------------------------------------
        // MOD 2: Timer la un anumit moment / data fixa
        // -------------------------------------------------------------
        JPanel panel2 = new JPanel(new BorderLayout(8, 8));
        panel2.setBorder(BorderFactory.createTitledBorder("2. Executie la un anumit timp (Ora exacta / Date fix)"));

        JPanel p2Controls = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 5));
        p2Controls.add(new JLabel("Programeaza peste (secunde de acum):"));
        spinnerExactSeconds = new JSpinner(new SpinnerNumberModel(10, 2, 300, 1));
        p2Controls.add(spinnerExactSeconds);

        btnStartExact = new JButton("Programeaza la Data/Ora");
        btnCancelExact = new JButton("Opreste Timer");
        btnCancelExact.setEnabled(false);
        p2Controls.add(btnStartExact);
        p2Controls.add(btnCancelExact);

        lblStatusExact = new JLabel("Stare: Inactiv");
        lblStatusExact.setForeground(new Color(80, 80, 80));
        p2Controls.add(lblStatusExact);
        panel2.add(p2Controls, BorderLayout.CENTER);

        // -------------------------------------------------------------
        // MOD 3: Timer periodic (cu perioada specificata)
        // -------------------------------------------------------------
        JPanel panel3 = new JPanel(new BorderLayout(8, 8));
        panel3.setBorder(BorderFactory.createTitledBorder("3. Executie cu o perioada indicata (Repetitiv - scheduleAtFixedRate)"));

        JPanel p3Controls = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 5));
        p3Controls.add(new JLabel("Perioada repetare (ms):"));
        spinnerPeriod = new JSpinner(new SpinnerNumberModel(1000, 200, 10000, 200));
        p3Controls.add(spinnerPeriod);

        btnStartPeriodic = new JButton("Porneste Monitorizare");
        btnStopPeriodic = new JButton("Opreste Monitorizare");
        btnStopPeriodic.setEnabled(false);
        p3Controls.add(btnStartPeriodic);
        p3Controls.add(btnStopPeriodic);

        lblStatusPeriodic = new JLabel("Stare: Oprit");
        lblStatusPeriodic.setForeground(new Color(80, 80, 80));
        p3Controls.add(lblStatusPeriodic);

        JPanel p3Progress = new JPanel(new BorderLayout(5, 5));
        p3Progress.setBorder(new EmptyBorder(0, 10, 5, 10));
        progressBar = new JProgressBar(0, 100);
        progressBar.setStringPainted(true);
        progressBar.setValue(0);
        p3Progress.add(new JLabel("Progres / Ciclu proces periodic:"), BorderLayout.NORTH);
        p3Progress.add(progressBar, BorderLayout.CENTER);

        panel3.add(p3Controls, BorderLayout.NORTH);
        panel3.add(p3Progress, BorderLayout.CENTER);

        // Adaugare carduri la panoul principal
        mainPanel.add(panel1);
        mainPanel.add(panel2);
        mainPanel.add(panel3);
        add(mainPanel, BorderLayout.CENTER);

        // -------------------------------------------------------------
        // Panou Inferior: Log de evenimente & buton Curatare Log
        // -------------------------------------------------------------
        JPanel logPanel = new JPanel(new BorderLayout(5, 5));
        logPanel.setBorder(new EmptyBorder(0, 15, 10, 15));
        
        JPanel logHeader = new JPanel(new BorderLayout());
        JLabel lblLog = new JLabel("Jurnal de activitate (Loguri Timere in timp real):");
        lblLog.setFont(new Font("Segoe UI", Font.BOLD, 12));
        JButton btnClearLog = new JButton("Curata Log");
        btnClearLog.addActionListener(e -> logArea.setText(""));
        logHeader.add(lblLog, BorderLayout.WEST);
        logHeader.add(btnClearLog, BorderLayout.EAST);
        logPanel.add(logHeader, BorderLayout.NORTH);

        logArea = new JTextArea(8, 50);
        logArea.setEditable(false);
        logArea.setFont(new Font("Consolas", Font.PLAIN, 12));
        logArea.setBackground(new Color(245, 247, 250));
        JScrollPane scrollPane = new JScrollPane(logArea);
        logPanel.add(scrollPane, BorderLayout.CENTER);

        add(logPanel, BorderLayout.SOUTH);

        // Atasare evenimente butoane
        setupActions();
    }

    private void setupActions() {
        // --- Actiune Timer 1 (Delay) ---
        btnStartDelay.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                startDelayTimer();
            }
        });

        btnCancelDelay.addActionListener(e -> cancelDelayTimer());

        // --- Actiune Timer 2 (Exact Time) ---
        btnStartExact.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                startExactTimeTimer();
            }
        });

        btnCancelExact.addActionListener(e -> cancelExactTimer());

        // --- Actiune Timer 3 (Periodic) ---
        btnStartPeriodic.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                startPeriodicTimer();
            }
        });

        btnStopPeriodic.addActionListener(e -> stopPeriodicTimer());
    }

    /**
     * MODUL 1: Planificare dupa un anumit interval de timp (schedule cu delay).
     */
    private void startDelayTimer() {
        if (timerDelay != null) {
            timerDelay.cancel();
        }
        int seconds = (Integer) spinnerDelay.getValue();
        long delayMillis = seconds * 1000L;

        timerDelay = new Timer("Timer-Delay-Thread", true);
        btnStartDelay.setEnabled(false);
        btnCancelDelay.setEnabled(true);
        lblStatusDelay.setText("Stare: Programat sa ruleze peste " + seconds + " secunde...");
        lblStatusDelay.setForeground(new Color(0, 102, 204));
        log("Timer 1: Sarcina programata sa se execute peste " + seconds + " sec.");

        timerDelay.schedule(new TimerTask() {
            @Override
            public void run() {
                // Notificare acustica (beep) conform exemplului din laborator
                Toolkit.getDefaultToolkit().beep();

                SwingUtilities.invokeLater(() -> {
                    lblStatusDelay.setText("Stare: Executat cu succes!");
                    lblStatusDelay.setForeground(new Color(0, 153, 51));
                    btnStartDelay.setEnabled(true);
                    btnCancelDelay.setEnabled(false);
                    log("Timer 1: S-a declansat sarcina cu delay de " + seconds + " sec! [BEEP]");
                });
            }
        }, delayMillis);
    }

    private void cancelDelayTimer() {
        if (timerDelay != null) {
            timerDelay.cancel();
            timerDelay = null;
        }
        lblStatusDelay.setText("Stare: Anulat forțat prin cancel()");
        lblStatusDelay.setForeground(Color.RED);
        btnStartDelay.setEnabled(true);
        btnCancelDelay.setEnabled(false);
        log("Timer 1: Anulat manual de catre utilizator.");
    }

    /**
     * MODUL 2: Planificare la un anumit timp specificat (schedule cu Date).
     */
    private void startExactTimeTimer() {
        if (timerExact != null) {
            timerExact.cancel();
        }

        int addSec = (Integer) spinnerExactSeconds.getValue();
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.SECOND, addSec);
        Date executionTime = cal.getTime();

        timerExact = new Timer("Timer-Exact-Thread", true);
        btnStartExact.setEnabled(false);
        btnCancelExact.setEnabled(true);
        lblStatusExact.setText("Stare: Programat exact pentru ora " + timeFormat.format(executionTime));
        lblStatusExact.setForeground(new Color(153, 102, 0));
        log("Timer 2: Planificat la momentul exact: " + timeFormat.format(executionTime));

        timerExact.schedule(new TimerTask() {
            @Override
            public void run() {
                Toolkit.getDefaultToolkit().beep();
                SwingUtilities.invokeLater(() -> {
                    lblStatusExact.setText("Stare: Rulat la " + timeFormat.format(new Date()));
                    lblStatusExact.setForeground(new Color(0, 153, 51));
                    btnStartExact.setEnabled(true);
                    btnCancelExact.setEnabled(false);
                    log("Timer 2: [ORA EXACTA ATINSA] Sarcina s-a executat la " + timeFormat.format(new Date()));
                });
            }
        }, executionTime);
    }

    private void cancelExactTimer() {
        if (timerExact != null) {
            timerExact.cancel();
            timerExact = null;
        }
        lblStatusExact.setText("Stare: Oprit forțat prin cancel()");
        lblStatusExact.setForeground(Color.RED);
        btnStartExact.setEnabled(true);
        btnCancelExact.setEnabled(false);
        log("Timer 2: Programarea pentru ora fixa a fost anulata.");
    }

    /**
     * MODUL 3: Planificare cu perioada indicata (scheduleAtFixedRate).
     */
    private void startPeriodicTimer() {
        if (timerPeriodic != null) {
            timerPeriodic.cancel();
        }

        int period = (Integer) spinnerPeriod.getValue();
        periodicCounter = 0;
        progressBar.setValue(0);

        timerPeriodic = new Timer("Timer-Periodic-Thread", true);
        btnStartPeriodic.setEnabled(false);
        btnStopPeriodic.setEnabled(true);
        lblStatusPeriodic.setText("Stare: Activ (la fiecare " + period + " ms)");
        lblStatusPeriodic.setForeground(new Color(0, 153, 51));
        log("Timer 3: Pornit cu perioada de " + period + " ms.");

        timerPeriodic.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                periodicCounter++;
                int progressVal = (periodicCounter * 10) % 110;
                if (progressVal > 100) progressVal = 100;

                final int currentCount = periodicCounter;
                final int currentProgress = progressVal;

                SwingUtilities.invokeLater(() -> {
                    progressBar.setValue(currentProgress);
                    lblStatusPeriodic.setText("Stare: Rulare pas #" + currentCount + " | Progres: " + currentProgress + "%");
                    log("Timer 3: Ciclu periodic #" + currentCount + " executat la " + timeFormat.format(new Date()));
                });
            }
        }, 0, period);
    }

    private void stopPeriodicTimer() {
        if (timerPeriodic != null) {
            timerPeriodic.cancel();
            timerPeriodic = null;
        }
        lblStatusPeriodic.setText("Stare: Oprit forțat");
        lblStatusPeriodic.setForeground(Color.RED);
        btnStartPeriodic.setEnabled(true);
        btnStopPeriodic.setEnabled(false);
        log("Timer 3: Timer-ul periodic a fost oprit prin cancel().");
    }

    private void log(String message) {
        String timestamp = timeFormat.format(new Date());
        logArea.append("[" + timestamp + "] " + message + "\n");
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    public static void main(String[] args) {
        // Setare Look and Feel modern
        try {
            for (UIManager.LookAndFeelInfo info : UIManager.getInstalledLookAndFeels()) {
                if ("Nimbus".equals(info.getName())) {
                    UIManager.setLookAndFeel(info.getClassName());
                    break;
                }
            }
        } catch (Exception ignored) {
        }

        SwingUtilities.invokeLater(() -> {
            ProcessSchedulerApp app = new ProcessSchedulerApp();
            app.setVisible(true);
        });
    }
}
