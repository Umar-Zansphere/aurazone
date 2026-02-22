const catchAsync = require('../../utils/catchAsync');
const authService = require('../services/auth.service');

const login = catchAsync(async (req, res) => authService.login(req, res));
const logout = catchAsync(async (req, res) => authService.logout(req, res));

module.exports = {
  login,
  logout,
};
