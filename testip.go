package main

import (
	"fmt"
	"net"
)

func main() {
	ip1 := net.ParseIP("172.18.0.1")
	fmt.Println("172.18.0.1 IsPrivate:", ip1.IsPrivate())

	ip2 := net.ParseIP("192.168.1.1")
	fmt.Println("192.168.1.1 IsPrivate:", ip2.IsPrivate())

	ip3 := net.ParseIP("127.0.0.1")
	fmt.Println("127.0.0.1 IsLoopback:", ip3.IsLoopback())
	fmt.Println("127.0.0.1 IsPrivate:", ip3.IsPrivate())
}
