import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type BinaryOp = '+' | '-' | '×' | '÷' | 'xʸ';

interface CalcState {
  display: string;
  operand: number | null;
  operator: BinaryOp | null;
  awaitingOperand: boolean;
}

const INITIAL_STATE: CalcState = {
  display: '0',
  operand: null,
  operator: null,
  awaitingOperand: false,
};

function applyBinaryOp(a: number, op: BinaryOp, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '×': return a * b;
    case '÷': return a / b;
    case 'xʸ': return Math.pow(a, b);
  }
}

function formatResult(n: number): string {
  if (!isFinite(n)) return n > 0 ? 'Infinity' : n < 0 ? '-Infinity' : 'Error';
  if (isNaN(n)) return 'Error';
  // Avoid floating-point noise
  const rounded = parseFloat(n.toPrecision(12));
  return String(rounded);
}

export default function App(): React.JSX.Element {
  const [state, setState] = useState<CalcState>(INITIAL_STATE);

  const handleDigit = (digit: string) => {
    setState(prev => {
      if (prev.awaitingOperand) {
        return { ...prev, display: digit, awaitingOperand: false };
      }
      const newDisplay =
        prev.display === '0' ? digit : prev.display + digit;
      return { ...prev, display: newDisplay };
    });
  };

  const handleDecimal = () => {
    setState(prev => {
      if (prev.awaitingOperand) {
        return { ...prev, display: '0.', awaitingOperand: false };
      }
      if (prev.display.includes('.')) return prev;
      return { ...prev, display: prev.display + '.' };
    });
  };

  const handleBinaryOp = (op: BinaryOp) => {
    setState(prev => {
      const current = parseFloat(prev.display);
      if (prev.operand !== null && !prev.awaitingOperand && prev.operator) {
        const result = applyBinaryOp(prev.operand, prev.operator, current);
        return {
          display: formatResult(result),
          operand: result,
          operator: op,
          awaitingOperand: true,
        };
      }
      return {
        ...prev,
        operand: current,
        operator: op,
        awaitingOperand: true,
      };
    });
  };

  const handleEquals = () => {
    setState(prev => {
      if (prev.operand === null || prev.operator === null) return prev;
      const current = parseFloat(prev.display);
      const result = applyBinaryOp(prev.operand, prev.operator, current);
      return {
        display: formatResult(result),
        operand: null,
        operator: null,
        awaitingOperand: true,
      };
    });
  };

  const handleUnary = (fn: (x: number) => number) => {
    setState(prev => {
      const x = parseFloat(prev.display);
      const result = fn(x);
      return {
        ...prev,
        display: formatResult(result),
        awaitingOperand: true,
      };
    });
  };

  const handleClear = () => setState(INITIAL_STATE);

  const handleBackspace = () => {
    setState(prev => {
      if (prev.awaitingOperand) return prev;
      const next = prev.display.length > 1 ? prev.display.slice(0, -1) : '0';
      return { ...prev, display: next };
    });
  };

  const handleToggleSign = () => {
    setState(prev => {
      const val = parseFloat(prev.display) * -1;
      return { ...prev, display: formatResult(val) };
    });
  };

  const { display, operator } = state;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={styles.container}>
        {/* Display */}
        <View style={styles.displayContainer}>
          <Text style={styles.operatorIndicator}>
            {operator ? `${operator}` : ''}
          </Text>
          <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
        </View>

        {/* Scientific row */}
        <View style={styles.row}>
          <CalcButton label="ln" onPress={() => handleUnary(x => Math.log(x))} style="fn" />
          <CalcButton label="log" onPress={() => handleUnary(x => Math.log10(x))} style="fn" />
          <CalcButton label="log₂" onPress={() => handleUnary(x => Math.log2(x))} style="fn" />
          <CalcButton label="xʸ" onPress={() => handleBinaryOp('xʸ')} style="fn" />
        </View>
        <View style={styles.row}>
          <CalcButton label="√x" onPress={() => handleUnary(x => Math.sqrt(x))} style="fn" />
          <CalcButton label="x²" onPress={() => handleUnary(x => Math.pow(x, 2))} style="fn" />
          <CalcButton label="+/-" onPress={handleToggleSign} style="fn" />
          <CalcButton label="⌫" onPress={handleBackspace} style="fn" />
        </View>

        {/* Main pad */}
        <View style={styles.row}>
          <CalcButton label="C" onPress={handleClear} style="clear" />
          <CalcButton label="(" onPress={() => {}} style="op" />
          <CalcButton label=")" onPress={() => {}} style="op" />
          <CalcButton label="÷" onPress={() => handleBinaryOp('÷')} style="op" />
        </View>
        <View style={styles.row}>
          <CalcButton label="7" onPress={() => handleDigit('7')} style="digit" />
          <CalcButton label="8" onPress={() => handleDigit('8')} style="digit" />
          <CalcButton label="9" onPress={() => handleDigit('9')} style="digit" />
          <CalcButton label="×" onPress={() => handleBinaryOp('×')} style="op" />
        </View>
        <View style={styles.row}>
          <CalcButton label="4" onPress={() => handleDigit('4')} style="digit" />
          <CalcButton label="5" onPress={() => handleDigit('5')} style="digit" />
          <CalcButton label="6" onPress={() => handleDigit('6')} style="digit" />
          <CalcButton label="-" onPress={() => handleBinaryOp('-')} style="op" />
        </View>
        <View style={styles.row}>
          <CalcButton label="1" onPress={() => handleDigit('1')} style="digit" />
          <CalcButton label="2" onPress={() => handleDigit('2')} style="digit" />
          <CalcButton label="3" onPress={() => handleDigit('3')} style="digit" />
          <CalcButton label="+" onPress={() => handleBinaryOp('+')} style="op" />
        </View>
        <View style={styles.row}>
          <CalcButton label="0" onPress={() => handleDigit('0')} style="digit" wide />
          <CalcButton label="." onPress={handleDecimal} style="digit" />
          <CalcButton label="=" onPress={handleEquals} style="equals" />
        </View>
      </View>
    </SafeAreaView>
  );
}

type ButtonStyle = 'digit' | 'op' | 'fn' | 'clear' | 'equals';

interface CalcButtonProps {
  label: string;
  onPress: () => void;
  style: ButtonStyle;
  wide?: boolean;
}

function CalcButton({ label, onPress, style: variant, wide }: CalcButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], wide && styles.wide]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, variant === 'fn' && styles.fnText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const BTN_SIZE = 72;
const BTN_RADIUS = 36;
const GAP = 12;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: GAP,
  },
  displayContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  operatorIndicator: {
    color: '#a78bfa',
    fontSize: 22,
    marginBottom: 4,
  },
  display: {
    color: '#ffffff',
    fontSize: 56,
    fontWeight: '300',
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  button: {
    height: BTN_SIZE,
    flex: 1,
    borderRadius: BTN_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wide: {
    flex: 2,
    borderRadius: BTN_RADIUS,
  },
  buttonText: {
    fontSize: 26,
    fontWeight: '400',
    color: '#ffffff',
  },
  fnText: {
    fontSize: 18,
  },
  digit: {
    backgroundColor: '#2d2d44',
  },
  op: {
    backgroundColor: '#4c3f91',
  },
  fn: {
    backgroundColor: '#252538',
  },
  clear: {
    backgroundColor: '#c0392b',
  },
  equals: {
    backgroundColor: '#7c3aed',
  },
});
