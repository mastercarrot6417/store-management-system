<?php
session_start();

unset(
    $_SESSION['customer_id'],
    $_SESSION['customer_name'],
    $_SESSION['customer_email'],
    $_SESSION['customer_role'],
    $_SESSION['user_id'],
    $_SESSION['user_name'],
    $_SESSION['user_email'],
    $_SESSION['user_role'],
    $_SESSION['customer_oauth_state']
);

header('Location: index.php');
exit();
