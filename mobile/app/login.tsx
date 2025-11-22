import { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Surface,
  HelperText,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return;
    }

    const success = await login(username.trim(), password);

    if (success) {
      router.replace('/(tabs)/dashboard');
    }
  };

  const hasErrors = !!error;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>OIH</Text>
            </View>
            <Text style={styles.title}>OpenIntraHub</Text>
            <Text style={styles.subtitle}>{t('auth.loginSubtitle', 'Your Enterprise Intranet')}</Text>
          </View>

          <Surface style={styles.formContainer} elevation={2}>
            <Text style={styles.formTitle}>{t('auth.login', 'Login')}</Text>

            <TextInput
              label={t('auth.username', 'Username')}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (error) clearError();
              }}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
              disabled={isLoading}
            />

            <TextInput
              label={t('auth.password', 'Password')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) clearError();
              }}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              disabled={isLoading}
            />

            {hasErrors && (
              <HelperText type="error" visible={hasErrors} style={styles.errorText}>
                {error || t('auth.loginFailed', 'Login failed. Please check your credentials.')}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading || !username.trim() || !password.trim()}
              style={styles.loginButton}
              contentStyle={styles.loginButtonContent}
            >
              {isLoading ? t('auth.loggingIn', 'Logging in...') : t('auth.login', 'Login')}
            </Button>
          </Surface>

          <Text style={styles.footerText}>
            {t('app.version', 'Version')} 0.1.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  errorText: {
    marginBottom: 8,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#9CA3AF',
    fontSize: 12,
  },
});
