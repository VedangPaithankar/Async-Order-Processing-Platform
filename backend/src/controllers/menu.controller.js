const { categories, items, modifierOptions } = require("../data/menu.data");

exports.getMenu = (req, res) => {
  res.json({
    categories,
    items,
    modifierOptions,
  });
};
