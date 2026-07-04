<?php
session_start();
require_once __DIR__ . '/config/google_customer.php';

header('Location: ' . getCustomerGoogleAuthUrl());
exit();
