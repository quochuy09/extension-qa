export const safeXssPayloads = [
  {
    id: 'html-marker',
    marker: 'xss-test-marker-001',
    value: '<xss-test-marker-001>'
  },
  {
    id: 'attribute-breakout-marker',
    marker: 'xss-test-marker-002',
    value: '"><xss-test-marker-002>'
  },
  {
    id: 'single-quote-breakout-marker',
    marker: 'xss-test-marker-003',
    value: "'><xss-test-marker-003>"
  }
];
