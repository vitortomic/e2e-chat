import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ContactListScreen } from '../screens/ContactListScreen';
import { ChatScreen } from '../screens/ChatScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ContactList: undefined;
  Chat: {
    contactId: string;
    contactName: string;
    isOnline?: boolean;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
  onLogout: () => void;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({
  isAuthenticated,
  onLoginSuccess,
  onLogout,
}) => {
  return (
    <Stack.Navigator>
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            options={{ headerShown: false }}
          >
            {props => <LoginScreen {...props} onLoginSuccess={onLoginSuccess} />}
          </Stack.Screen>
          <Stack.Screen
            name="Register"
            options={{ headerShown: false }}
          >
            {props => <RegisterScreen {...props} onRegisterSuccess={onLoginSuccess} />}
          </Stack.Screen>
        </>
      ) : (
        <>
          <Stack.Screen
            name="ContactList"
            options={{ headerShown: false }}
          >
            {props => <ContactListScreen {...props} onLogout={onLogout} />}
          </Stack.Screen>
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerBackTitle: 'Back',
              headerTintColor: '#fff',
              headerStyle: {
                backgroundColor: '#7c3aed',
              },
              headerTitleStyle: {
                color: '#fff',
                fontWeight: 'bold',
              },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
