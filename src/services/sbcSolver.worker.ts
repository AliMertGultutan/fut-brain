import { solveClubAndTokenSbc, solveNormalSbc } from './sbcSolver.ts';

self.onmessage = ({ data }) => {
  try {
    const solution = data.mode === 'CLUB_TOKEN'
      ? solveClubAndTokenSbc(data.challenge, data.club, data.market, data.inventory, data.options)
      : solveNormalSbc(data.challenge, data.market, data.options);
    self.postMessage({ solution });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Hesaplama başarısız.' });
  }
};
