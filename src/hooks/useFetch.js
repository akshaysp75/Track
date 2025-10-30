import axios from 'axios';
import { useState, useEffect } from 'react';

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true); // default to true
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const source = axios.CancelToken.source();

    setLoading(true);
    setData(null);
    setError(null);

    axios
      .get(url, { cancelToken: source.token })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) {
          setError(err.message || 'An error occurred.');
          setLoading(false);
        }
      });

    return () => {
      source.cancel('Request canceled.');
    };
  }, [url]);

  return { data, loading, error };
}

export default useFetch;
