require("dotenv").config();
const app = require("./server/app");

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`MDL website running at http://localhost:${PORT}`);
});
