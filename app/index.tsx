import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';

export default function RootIndex() {
  const [initialRoute, setInitialRoute] = useState<Href | null>(null);

  useEffect(() => {
    const resolveInitialRoute = async () => {
      try {
        const storedAuth = await AsyncStorage.getItem('@auth:isAuthenticated');
        if (storedAuth === 'true') {
          setInitialRoute('/(tabs)/home');
        } else {
          setInitialRoute('/login');
        }
      } catch (error) {
        console.warn('Failed to determine initial route', error);
        setInitialRoute('/login');
      }
    };

    void resolveInitialRoute();
  }, []);

  if (!initialRoute) {
    return null;
  }

  return <Redirect href={initialRoute} />;
}

