export const getStatus = (req, res) => {
  res.json({ 
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}; 