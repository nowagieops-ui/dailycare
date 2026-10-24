(function () {
  var PAGES = [
    ['index.html', 'Overview'],
    ['DSP-Login.html', 'DSP · Log In'],
    ['DSP-ForgotPassword.html', 'DSP · Forgot Password'],
    ['DSP-Onboarding.html', 'DSP · Create Account'],
    ['DSP-Home.html', 'DSP · Home'],
    ['DSP-Schedule.html', 'DSP · Schedule'],
    ['DSP-ClockIn.html', 'DSP · Clock In/Out'],
    ['DSP-MissedClockIn.html', 'DSP · Report Missed Clock-In'],
    ['DSP-Tasks.html', 'DSP · Visit Checklist'],
    ['DSP-Documents.html', 'DSP · My Documents'],
    ['DSP-DocumentFill.html', 'DSP · Fill Document'],
    ['DSP-DocumentSign.html', 'DSP · Review & Sign (PDF)'],
    ['DSP-Training.html', 'DSP · Training & Credentials'],
    ['DSP-Notifications.html', 'DSP · Notifications'],
    ['DSP-Settings.html', 'DSP · Settings'],
    ['DSP-Chat.html', 'DSP · Team Chat'],
    ['Admin-Login.html', 'Admin · Log In'],
    ['Admin-ForgotPassword.html', 'Admin · Forgot Password'],
    ['Admin-Dashboard.html', 'Admin · Dashboard'],
    ['Admin-Scheduling.html', 'Admin · Scheduling'],
    ['Admin-AddShift.html', 'Admin · New Shift'],
    ['Admin-Staff.html', 'Admin · Staff Directory'],
    ['Admin-StaffDetail.html', 'Admin · Staff Detail'],
    ['Admin-AddStaff.html', 'Admin · Add Staff'],
    ['Admin-Clients.html', 'Admin · Clients Directory'],
    ['Admin-ClientDetail.html', 'Admin · Client Detail'],
    ['Admin-AddClient.html', 'Admin · Add Client'],
    ['Admin-Compliance.html', 'Admin · eBinders'],
    ['Admin-DocumentDetail.html', 'Admin · Document Detail'],
    ['Admin-Training.html', 'Admin · Training & Credentials'],
    ['Admin-Attendance.html', 'Admin · Time & Attendance'],
    ['Admin-Reports.html', 'Admin · Reports'],
    ['Admin-Notifications.html', 'Admin · Notifications'],
    ['Admin-AuditLog.html', 'Admin · Audit Log'],
    ['Admin-Settings.html', 'Admin · Settings'],
    ['Family-Login.html', 'Family · Log In'],
    ['Family-ForgotPassword.html', 'Family · Forgot Password'],
    ['Family-Home.html', 'Family · Home'],
    ['Family-CarePlan.html', 'Family · ISP / Care Plan'],
    ['Family-DocumentSign.html', 'Family · Sign Consent (PDF)'],
    ['Family-Visits.html', 'Family · Visit History'],
    ['Family-Messages.html', 'Family · Messages'],
    ['Family-Settings.html', 'Family · Settings'],
  ];

  function currentFile() {
    var p = location.pathname.split('/').pop();
    return p === '' ? 'index.html' : p;
  }

  var file = currentFile();
  var idx = -1;
  for (var i = 0; i < PAGES.length; i++) {
    if (PAGES[i][0] === file) { idx = i; break; }
  }
  if (idx === -1) return; // unknown page, skip nav

  var prev = idx > 0 ? PAGES[idx - 1] : null;
  var next = idx < PAGES.length - 1 ? PAGES[idx + 1] : null;

  var bar = document.createElement('div');
  bar.setAttribute('id', 'dcs-nav-bar');
  bar.style.cssText = [
    'position:sticky', 'top:0', 'z-index:99999', 'display:flex', 'align-items:center',
    'justify-content:space-between', 'gap:8px', 'padding:8px 14px',
    'background:#190D39', 'color:#fff', 'font-family:Inter,system-ui,sans-serif',
    'font-size:13px', 'box-shadow:0 2px 6px rgba(0,0,0,0.15)'
  ].join(';');

  function side(label, target, align) {
    var a = document.createElement(target ? 'a' : 'span');
    a.textContent = label;
    a.style.cssText = 'color:#fff;text-decoration:none;font-weight:600;white-space:nowrap;opacity:' + (target ? '1' : '0.35') + ';flex:0 0 auto;';
    if (target) a.setAttribute('href', target);
    return a;
  }

  var prevEl = side(prev ? '‹ ' + prev[1] : '‹ Prev', prev ? prev[0] : null);
  var nextEl = side(next ? next[1] + ' ›' : 'Next ›', next ? next[0] : null);

  var mid = document.createElement('div');
  mid.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;';
  var midLink = document.createElement('a');
  midLink.href = 'index.html';
  midLink.textContent = 'All pages';
  midLink.style.cssText = 'color:#fff;text-decoration:underline;font-weight:600;';
  var counter = document.createElement('span');
  counter.textContent = (idx + 1) + ' / ' + PAGES.length + ' · ' + PAGES[idx][1];
  counter.style.cssText = 'opacity:0.7;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;';
  mid.appendChild(midLink);
  mid.appendChild(counter);

  bar.appendChild(prevEl);
  bar.appendChild(mid);
  bar.appendChild(nextEl);

  document.body.insertBefore(bar, document.body.firstChild);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && prev) location.href = prev[0];
    if (e.key === 'ArrowRight' && next) location.href = next[0];
  });

  var touchStartX = null;
  var touchStartY = null;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) { touchStartX = null; touchStartY = null; return; } // ignore pinch/multi-touch
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) { touchStartX = null; touchStartY = null; } // pinch started mid-gesture
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchStartX === null || touchStartY === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    if (Math.abs(dx) < 70) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // require a clearly horizontal gesture
    if (dx < 0 && next) location.href = next[0];
    if (dx > 0 && prev) location.href = prev[0];
  }, { passive: true });
})();
