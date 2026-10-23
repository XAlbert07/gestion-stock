const app = require("./app");
const { validateEnvironment } = require("./config/environment");

validateEnvironment();

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
