<?php
// Google Maps Embed API configuration.
// Values are loaded from the project root .env file.
require_once __DIR__ . '/env_loader.php';

define('GOOGLE_MAPS_API_KEY', env('GOOGLE_MAPS_API_KEY', ''));
define('COMPANY_MAP_QUERY', env('COMPANY_MAP_QUERY', 'MY DREAM BIKE SDN BHD'));
define('COMPANY_MAP_LINK', env('COMPANY_MAP_LINK', '#'));
