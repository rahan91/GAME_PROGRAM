(function () {
  if (document.querySelector('.crt')) return;

  var overlay = document.createElement('div');
  overlay.className = 'crt';

  var grille = document.createElement('div');
  grille.className = 'crt__grille';

  var specular = document.createElement('div');
  specular.className = 'crt__specular';

  var glow = document.createElement('div');
  glow.className = 'crt__glow';

  overlay.appendChild(grille);
  overlay.appendChild(specular);
  overlay.appendChild(glow);
  document.body.appendChild(overlay);
})();
