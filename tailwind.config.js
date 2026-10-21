/** Regenerate tailwind.css after changing utility classes in the HTML or JS:
 *  npx --yes tailwindcss@3.4.17 -c tailwind.config.js -o tailwind.css --minify
 */
module.exports = {
  content: ['./index.html', './en.html', './js/**/*.js'],
  corePlugins: { preflight: true },
};
