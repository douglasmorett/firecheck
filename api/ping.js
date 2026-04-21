module.exports = (req, res) => {
  res.status(200).json({ status: 'pong', message: 'Servidor vivo!' });
};
