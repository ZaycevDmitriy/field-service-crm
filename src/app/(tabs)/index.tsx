import { StyleSheet, Text, View } from 'react-native';

// Временная заглушка. Полноценный DashboardPage появится в шаге C (pages/dashboard).
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Главная</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
  },
});
