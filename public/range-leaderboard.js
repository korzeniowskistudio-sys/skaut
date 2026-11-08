import {locale,t,tr} from './i18n.js?v=20261108-range-leaderboard';

export function rangeLeaderboardMarkup() {
  return `<section class="range-leaderboard" data-range-leaderboard aria-labelledby="range-leaderboard-title">
    <h2 id="range-leaderboard-title">${t('Ranking gry')}</h2>
    <ol data-range-records></ol>
    <p data-range-record-status role="status"></p>
    <dialog class="range-record-dialog" aria-labelledby="range-record-title">
      <form>
        <h2 id="range-record-title">${t('Nowy rekord gry!')}</h2>
        <p data-range-record-prompt></p>
        <label class="field">${t('Imię lub pseudonim')}
          <input name="displayName" required maxlength="24" autocomplete="off" autofocus>
        </label>
        <p data-range-record-error role="alert"></p>
        <div class="range-record-actions">
          <button class="btn" type="submit">${t('Opublikuj wynik')}</button>
          <button class="btn secondary" type="button" data-range-record-skip>${t('Pomiń')}</button>
        </div>
      </form>
    </dialog>
  </section>`;
}

export function mountRangeLeaderboard(root, request, signal) {
  const list = root.querySelector('[data-range-records]');
  const status = root.querySelector('[data-range-record-status]');
  const dialog = root.querySelector('dialog');
  const form = dialog.querySelector('form');
  const publish = form.querySelector('[type=submit]');
  const skip = dialog.querySelector('[data-range-record-skip]');
  const error = dialog.querySelector('[data-range-record-error]');
  let pending = null;

  function call(path, method, body) {
    const requestSignal = AbortSignal.any && AbortSignal.timeout
      ? AbortSignal.any([signal,AbortSignal.timeout(5000)]) : signal;
    return request('/range/'+path, method, body, requestSignal);
  }

  function draw(records) {
    if (signal.aborted) return;
    list.replaceChildren(...records.map(({name,score}) => {
      const row = document.createElement('li');
      const player = document.createElement('span');
      player.textContent = name;
      const result = document.createElement('strong');
      result.textContent = score.toLocaleString(locale);
      row.append(player,result);
      return row;
    }));
    status.textContent = records.length ? '' : t('Zagraj i ustanów pierwszy rekord.');
  }

  function unavailable() {
    if (!signal.aborted) status.textContent = t('Ranking jest chwilowo niedostępny.');
  }

  call('records').then(draw).catch(unavailable);
  skip.addEventListener('click', () => dialog.close(), {signal});
  dialog.addEventListener('cancel', event => { if (publish.disabled) event.preventDefault(); }, {signal});
  dialog.addEventListener('close', () => { pending=null; }, {signal});
  signal.addEventListener('abort', () => { if (dialog.open) dialog.close(); }, {once:true});

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!pending || publish.disabled) return;
    const entry = {...pending,displayName:new FormData(form).get('displayName')};
    publish.disabled = skip.disabled = true;
    error.textContent = '';
    try {
      const result = await call('records','POST',entry);
      if (signal.aborted) return;
      draw(result.records);
      dialog.close();
      status.textContent = result.published ? t('Twój wynik jest w rankingu.') : t('W rankingu jest już wyższy lub równy wynik.');
    } catch (failure) {
      if (!signal.aborted) error.textContent = failure.status ? failure.message : t('Nie udało się zapisać wyniku. Spróbuj ponownie.');
    } finally {
      publish.disabled = skip.disabled = false;
    }
  }, {signal});

  return {
    async startRound() {
      try { return await call('round','POST',{}); }
      catch { unavailable(); return null; }
    },
    async offerRecord(round, score, shots, isCurrent) {
      if (!round || score<=0) return;
      try {
        const records=await call('records');
        if (signal.aborted) return;
        draw(records);
        if (!isCurrent() || score<=(records[0]?.score ?? 0)) return;
        pending = {roundId:round.id,shots};
        form.reset();
        error.textContent = '';
        dialog.querySelector('[data-range-record-prompt]').textContent =
          tr`Wynik: ${score} pkt. Ta nazwa pojawi się publicznie obok wyniku.`;
        dialog.showModal();
      } catch { unavailable(); }
    },
  };
}
