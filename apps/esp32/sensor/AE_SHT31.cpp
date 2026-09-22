//---------------------------------------------------//
//  AKIZUKI DENSHI TSUSHO CO.,LTD.
//  Version 1.1  2018-07-29
//---------------------------------------------------//


#include "AE_SHT31.h"

AE_SHT31::AE_SHT31(uint8_t i2caddr) {
  _i2caddr = i2caddr;
  Wire.begin(); 
}

void AE_SHT31::i2c_write(uint16_t data)
{
  Wire.beginTransmission(_i2caddr);
  Wire.write(data>>8); 
  Wire.write(data&0xFF);
  Wire.endTransmission();
}
void AE_SHT31::i2c_read(uint8_t data[],uint8_t num)
{
  Wire.requestFrom(_i2caddr,(uint8_t)num);
  while (Wire.available() != num); 
  for (int i=0; i<num; i++) {
    data[i] = Wire.read();
  }
}

void AE_SHT31::BussReset(void)
{
  Wire.beginTransmission(_i2caddr);
  Wire.write(0x00); 
  Wire.write(0x06);
  Wire.endTransmission();
}

void AE_SHT31::SoftReset(void)
{
  i2c_write(0x30A2);
  delay(500);
  i2c_write(0x3041);
  delay(500);
}

void AE_SHT31::Heater(uint8_t onoff)
{
  if(onoff==1)i2c_write(0x306D);
  else i2c_write(0x3066);
  delay(500);
}


uint16_t AE_SHT31::ReadStatus(void)
{
  uint8_t data[3];
  i2c_write(0xF32D);
  i2c_read(data,3);
  //Serial.println(data[0]<<8|data[1], HEX);
  return (data[0]<<8|data[1]);
}

void AE_SHT31::GetTempHum(void)
{
  uint8_t data[7];
    
  i2c_write(0x2400);
  delay(300);
  i2c_read(data,6);
  temperature = -45.0 + (175.0 * ((data[0] * 256.0) + data[1]) / 65535.0);
  humidity = (100.0 * ((data[3] * 256.0) + data[4])) / 65535.0;
  //Serial.println(temperature);
  //Serial.println(humidity);
}

float AE_SHT31::Temperature(void)
{
 return temperature;
}

float AE_SHT31::Humidity(void)
{
 return humidity;
}
