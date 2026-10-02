/* Workshop configuration.
   Most values can also be changed from the settings panel on the landing page. */
window.IPOS_CONFIG = {
  // Workshop room. Each room is an independent board; a secret key is generated
  // on the facilitator computer and travels to the phones inside the QR code.
  room: "ipos-now-paris",

  // Message relays used to carry phone contributions to the board.
  // Messages are end-to-end encrypted; nothing is stored on the relays.
  // Several are listed so that the tool keeps working if one is unreachable.
  brokers: [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt"
  ],

  // Google Slides links (any share link works; it is converted to an embed).
  slidesSession1: "",
  slidesSession4: "https://docs.google.com/presentation/d/1Yh1PN97jxEBRizw66KIPGPLH4Y1aUdQPYo4oSiOwaSw/edit",

  // Shared Google Drive folder for Session 6.
  drive: "",

  // First month of the 13-month programme (YYYY-MM).
  start: "2026-11"
};
