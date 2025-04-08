<?php
// Email penerima
$receiving_email_address = 'fujihadi1997@gmail.com';

// Ambil data dari form
$name = isset($_POST['name']) ? htmlspecialchars($_POST['name']) : '';
$email = isset($_POST['email']) ? htmlspecialchars($_POST['email']) : '';
$subject = isset($_POST['subject']) ? htmlspecialchars($_POST['subject']) : '';
$message = isset($_POST['message']) ? htmlspecialchars($_POST['message']) : '';

// Validasi input
if (empty($name) || empty($email) || empty($subject) || empty($message)) {
    die('Semua Data harus diisi!');
}

// Buat isi email
$email_content = "From: $name\n";
$email_content = "Email: $email\n";
$email_content = "Subject: $subject\n";
$email_content = "Message:\n$message\n";

// Header email
$headers = "From: $name <$email>\r\n";
$headers .= "Reply-To: $email\r\n";

// Kirim email
if (mail($receiving_email_address, $subject, $email_content, $headers)) {
    echo 'Pesan berhasil dikirim!';
} else {
    echo 'Terjadi kesalahan saat mengirim pesan.';
}
?>
<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $secret = "6LcAsA4rAAAAAHxNcgM4aoxmyXvro8HUu3Ypoluw"; // Get this from reCAPTCHA admin
    $response = $_POST['g-recaptcha-response'];
    $remoteip = $_SERVER['REMOTE_ADDR'];
    
    $url = "https://www.google.com/recaptcha/api/siteverify?secret=$secret&response=$response&remoteip=$remoteip";
    $data = file_get_contents($url);
    $row = json_decode($data, true);
    
    if ($row['success']) {
        // Process your form here
    } else {
        // reCAPTCHA failed
        echo "Please complete the reCAPTCHA verification.";
    }
}
?>